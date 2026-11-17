import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('HERMES UI ErrorBoundary caught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[260px] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-border bg-card text-foreground p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-foreground">
                  {this.props.fallbackTitle || 'Se produjo un error en esta vista'}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {this.props.fallbackDescription ||
                    'La simulación y tus datos guardados siguen intactos. Puedes reintentar esta vista o recargar la aplicación.'}
                </p>
              </div>
            </div>

            {this.state.errorMessage && (
              <pre className="text-[11px] font-mono bg-background/80 border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-words">
                {this.state.errorMessage}
              </pre>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" onClick={this.handleRetry} className="gap-1.5 cursor-pointer">
                <RotateCcw size={14} />
                <span>Reintentar vista</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
                className="cursor-pointer"
              >
                Recargar aplicación
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
