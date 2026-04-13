<<<<<<< HEAD
/** 构建时由 webpack DefinePlugin 注入（git describe / commit 等） */
declare const __APP_VERSION__: string;

=======
>>>>>>> df19bf5a213c5e38b25c07c65b47a908c4cdd7ce
declare module '*?raw' {
  const content: string;
  export default content;
}
declare module '*?url' {
  const content: string;
  export default content;
}
<<<<<<< HEAD
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
=======
>>>>>>> df19bf5a213c5e38b25c07c65b47a908c4cdd7ce
declare module '*.css' {
  const content: unknown;
  export default content;
}
<<<<<<< HEAD
=======
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
declare module '*.yaml' {
  const content: any;
  export default content;
}
>>>>>>> df19bf5a213c5e38b25c07c65b47a908c4cdd7ce
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}

declare const YAML: typeof import('yaml');

declare const z: typeof import('zod');
declare namespace z {
  export type infer<T> = import('zod').infer<T>;
  export type input<T> = import('zod').input<T>;
  export type output<T> = import('zod').output<T>;
}

declare module 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js' {
<<<<<<< HEAD
  export function registerMvuSchema(schema: z.ZodType<Record<string, any>> | (() => z.ZodType<Record<string, any>>)): void;
}

/** 小手机壳脚本（src/小手机壳）挂载到酒馆页面，供主界面等 iframe 通过 window.parent 调用 */
interface TavernPhoneApi {
  readonly version: string;
  readonly isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  getIframeWindow: () => Window | null;
}

interface Window {
  TavernPhone?: TavernPhoneApi;
=======
  export function registerMvuSchema(
    schema: z.ZodType<Record<string, any>> | (() => z.ZodType<Record<string, any>>),
  ): void;
>>>>>>> df19bf5a213c5e38b25c07c65b47a908c4cdd7ce
}
