import React from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from "react-native";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class AppErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
    errorStack: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message ?? "Unexpected error",
      errorStack: error.stack ?? null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App crashed", error, errorInfo.componentStack);
    if (Platform.OS === 'web') {
      console.error('[ErrorBoundary] Web error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.container} testID="app-error-boundary">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          {Platform.OS === 'web' && this.state.errorStack && (
            <View style={styles.stackContainer}>
              <Text style={styles.stackText}>{this.state.errorStack}</Text>
            </View>
          )}
          <Text style={styles.hint}>Check your network connection and try again.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={this.handleReset}
            testID="retry-app-button"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: "#0f172a",
  },
  stackContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: '100%',
  },
  stackText: {
    fontSize: 10,
    color: "#94a3b8",
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#cbd5f5",
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#38bdf8",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
});
