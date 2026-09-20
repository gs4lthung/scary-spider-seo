interface TurnstileWidget {
  getResponse(widgetId?: string): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
  execute(widgetId?: string): void;
  render(container: string | HTMLElement, options?: Record<string, unknown>): string;
}

interface Window {
  turnstile?: TurnstileWidget;
}
