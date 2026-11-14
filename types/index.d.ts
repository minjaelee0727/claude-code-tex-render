export type Rendered = { png: string; width: number; height: number }

declare module 'claude-code' {
  interface PluginState {
    'tex-render': { renders: Shaped<Record<string, Rendered>> }
  }
}
