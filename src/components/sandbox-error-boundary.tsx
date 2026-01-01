"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangleIcon, RefreshCcwIcon, CloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallbackUrl?: string;
  onRetry?: () => void;
  onFallbackToCloud?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  useCloudFallback: boolean;
}

export class SandboxErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, useCloudFallback: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, useCloudFallback: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[SandboxErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, useCloudFallback: false });
    this.props.onRetry?.();
  };

  handleFallbackToCloud = () => {
    this.setState({ hasError: false, error: null, useCloudFallback: true });
    this.props.onFallbackToCloud?.();
  };

  render() {
    if (this.state.useCloudFallback && this.props.fallbackUrl) {
      return (
        <div className="flex flex-col w-full h-full">
          <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
            <div className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-600 rounded-md">
              <CloudIcon className="h-3 w-3" />
              Cloud Sandbox (Fallback)
            </div>
          </div>
          <iframe
            className="h-full w-full"
            sandbox="allow-forms allow-scripts allow-same-origin"
            loading="lazy"
            src={this.props.fallbackUrl}
            title="Cloud Sandbox Preview"
          />
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-background p-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Preview Error</AlertTitle>
            <AlertDescription className="space-y-4">
              <p>
                Something went wrong while loading the preview.
                {this.state.error?.message && (
                  <span className="block text-xs mt-1 font-mono opacity-70">
                    {this.state.error.message}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCcwIcon className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                {this.props.fallbackUrl && (
                  <Button onClick={this.handleFallbackToCloud} variant="outline" size="sm">
                    <CloudIcon className="mr-2 h-4 w-4" />
                    Use Cloud
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
