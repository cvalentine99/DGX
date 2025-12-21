import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  FileJson,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface GeneratedExample {
  id: string;
  playbook: string;
  category: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    reasoning_content?: string;
  }[];
  metadata: {
    timeRange: string;
    metrics: string[];
    objectType: string;
    generatedAt: string;
  };
}

interface ValidationPanelProps {
  examples: GeneratedExample[];
  onValidationComplete?: (result: ValidationResult) => void;
}

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  errors: { id: string; error: string }[];
}

export default function ValidationPanel({ examples, onValidationComplete }: ValidationPanelProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const validateMutation = trpc.trainingData.validate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setIsValidating(false);
      onValidationComplete?.(data);
      if (data.invalid === 0) {
        toast.success("All examples passed validation!");
      } else {
        toast.warning(`${data.invalid} examples failed validation`);
      }
    },
    onError: (error) => {
      setIsValidating(false);
      toast.error(`Validation failed: ${error.message}`);
    },
  });

  const handleValidate = () => {
    setIsValidating(true);
    validateMutation.mutate({ examples });
  };

  const validationRate = result ? (result.valid / result.total) * 100 : 0;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Data Validation
          </CardTitle>
          <Button
            onClick={handleValidate}
            disabled={isValidating}
            className="gap-2"
          >
            {isValidating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Validation
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!result ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <FileJson className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No validation results yet</p>
            <p className="text-sm">Click "Run Validation" to check data quality</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <FileJson className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold">{result.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">Valid</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">{result.valid}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Invalid</span>
                </div>
                <p className="text-2xl font-bold text-red-400">{result.invalid}</p>
              </div>
            </div>

            {/* Validation Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Validation Rate</span>
                <span className={validationRate === 100 ? "text-blue-400" : "text-yellow-400"}>
                  {validationRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={validationRate} className="h-2" />
            </div>

            {/* Errors List */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span>Validation Errors ({result.errors.length})</span>
                </div>
                <ScrollArea className="h-[150px] rounded-md border border-border p-2">
                  <div className="space-y-2">
                    {result.errors.map((err, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20"
                      >
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <Badge variant="outline" className="text-xs mb-1">
                            {err.id}
                          </Badge>
                          <p className="text-sm text-red-400">{err.error}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Success Message */}
            {result.invalid === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20"
              >
                <CheckCircle2 className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="font-medium text-blue-400">All Examples Valid</p>
                  <p className="text-sm text-muted-foreground">
                    Training data is ready for export and fine-tuning
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
