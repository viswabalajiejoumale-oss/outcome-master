import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UploadZone } from "@/components/upload/UploadZone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function UploadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([]);
  const [fileContent, setFileContent] = useState("");
  const [syllabusTitle, setSyllabusTitle] = useState("");
  const [courseOutcomes, setCourseOutcomes] = useState("");

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploadedFiles([{ name: file.name, size: file.size }]);
    setSyllabusTitle(file.name.replace(/\.[^/.]+$/, ""));

    // Read text content for .txt files
    if (file.name.endsWith(".txt")) {
      const text = await file.text();
      setFileContent(text);
    } else {
      // For PDF/DOCX, we'd need server-side processing
      setFileContent(`[Content from ${file.name} - requires server-side parsing]`);
      toast({
        title: "File uploaded",
        description: "PDF/DOCX parsing will be done server-side during generation.",
      });
    }
  };

  const handleGenerate = async () => {
    if (!syllabusTitle.trim()) {
      toast({ title: "Please enter a syllabus title", variant: "destructive" });
      return;
    }

    if (!courseOutcomes.trim()) {
      toast({ title: "Please enter course outcomes", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      // Create syllabus record with user_id
      const { data: syllabus, error: syllabusError } = await supabase
        .from("syllabi")
        .insert({
          title: syllabusTitle,
          content: fileContent || "Manual entry",
          file_name: uploadedFiles[0]?.name || null,
          user_id: user?.id,
        })
        .select()
        .single();

      if (syllabusError) throw syllabusError;

      // Parse and create course outcomes
      const coLines = courseOutcomes
        .split("\n")
        .filter((line) => line.trim())
        .map((line, index) => {
          const match = line.match(/^(CO\d+|[A-Z]+\d*):?\s*(.+)$/i);
          if (match) {
            return { code: match[1].toUpperCase(), description: match[2].trim(), unit: index + 1 };
          }
          return { code: `CO${index + 1}`, description: line.trim(), unit: index + 1 };
        });

      const { error: coError } = await supabase.from("course_outcomes").insert(
        coLines.map((co) => ({
          syllabus_id: syllabus.id,
          code: co.code,
          description: co.description,
          unit_number: co.unit,
        }))
      );

      if (coError) throw coError;

      // Call the generate-questions edge function
      const { data: genData, error: genError } = await supabase.functions.invoke("generate-questions", {
        body: {
          syllabusId: syllabus.id,
          content: fileContent || courseOutcomes,
          courseOutcomes: coLines,
        },
      });

      console.log("Edge function response:", { genData, genError });

      if (genError) throw genError;

      // Check for error in response data (edge functions may return errors in data)
      if (genData?.error) {
        throw new Error(genData.error);
      }

      const questionsGenerated = genData?.questionsGenerated || 0;
      
      if (questionsGenerated === 0) {
        toast({
          title: "No questions generated",
          description: "The AI could not generate questions. Check the edge function logs for details.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Questions Generated!",
          description: `Created ${questionsGenerated} questions.`,
        });
      }

      // Navigate to questions page
      navigate("/questions");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout title="Upload Syllabus" description="Upload and configure your syllabus for question generation">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Upload Section */}
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Syllabus Document</h3>
            <p className="text-sm text-muted-foreground">
              Upload your syllabus PDF, DOCX, or text file
            </p>
          </div>
          <UploadZone
            onFilesSelected={handleFilesSelected}
            uploadedFiles={uploadedFiles}
            onRemoveFile={() => {
              setUploadedFiles([]);
              setFileContent("");
            }}
            isUploading={false}
          />
        </div>

        {/* Configuration Section */}
        <div className="bg-card rounded-xl border p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Configure the syllabus details and course outcomes
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Syllabus Title</Label>
              <Input
                id="title"
                placeholder="e.g., Data Structures and Algorithms"
                value={syllabusTitle}
                onChange={(e) => setSyllabusTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outcomes">Course Outcomes (one per line)</Label>
              <Textarea
                id="outcomes"
                placeholder={`CO1: Understand fundamental data structures
CO2: Apply sorting and searching algorithms
CO3: Analyze algorithmic complexity
CO4: Design efficient solutions to computational problems`}
                rows={6}
                value={courseOutcomes}
                onChange={(e) => setCourseOutcomes(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Format: CO1: Description (or just the description - codes will be auto-generated)
              </p>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleGenerate}
          disabled={isProcessing || !syllabusTitle.trim() || !courseOutcomes.trim()}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Questions...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Questions with AI
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Questions will be generated and audited using Gemini 2.5 Flash
        </p>
      </div>
    </AppLayout>
  );
}
