declare module 'robots-txt-parse' {
    export class RobotsTxt {
      constructor(content: string);
      isAllowed(userAgent: string, url: string): boolean;
    }
  }