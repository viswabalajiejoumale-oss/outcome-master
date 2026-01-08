import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <AppLayout title="Settings" description="Configure your question generator">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>
              Configure the AI models used for question generation and auditing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Generator Model</Label>
              <Input value="MiMo-V2-Flash (via OpenRouter)" disabled />
              <p className="text-xs text-muted-foreground">
                Used for generating questions from syllabus content
              </p>
            </div>
            <div className="space-y-2">
              <Label>Auditor Model</Label>
              <Input value="Gemini 2.5 Flash (via OpenRouter)" disabled />
              <p className="text-xs text-muted-foreground">
                Used for quality assessment and feedback
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>
              Customize how questions are generated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Audit</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically audit questions after generation
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Source Paragraphs</Label>
                <p className="text-xs text-muted-foreground">
                  Store the source text for each question
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Questions per Outcome</Label>
              <Input type="number" defaultValue="5" className="w-24" />
              <p className="text-xs text-muted-foreground">
                Target number of questions per course outcome
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Settings</CardTitle>
            <CardDescription>
              Configure default export options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Rubrics</Label>
                <p className="text-xs text-muted-foreground">
                  Add marking rubrics to exported question papers
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Bloom Levels</Label>
                <p className="text-xs text-muted-foreground">
                  Display Bloom's taxonomy level for each question
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button>Save Settings</Button>
        </div>
      </div>
    </AppLayout>
  );
}
