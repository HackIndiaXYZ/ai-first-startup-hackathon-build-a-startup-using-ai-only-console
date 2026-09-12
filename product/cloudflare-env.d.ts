declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    AI_PROVIDER?: string;
    FIREWORKS_API_KEY?: string;
    FIREWORKS_MODEL?: string;
  }
}
