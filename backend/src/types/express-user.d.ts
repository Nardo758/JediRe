import type { Readable } from 'stream';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      /** Legacy session field. New tokens set userId. */
      id?: string;
      role?: string;
      user_type?: 'human' | 'agent' | 'human_sponsor' | 'human_lp' | 'human_lender' | 'system';
      agent_id?: string;
      capabilities?: string[];
    }

    // multer 2 ships no types. These match the File object multer attaches.
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination?: string;
        filename?: string;
        path?: string;
        buffer?: Buffer;
        stream?: Readable;
      }
    }

    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}

export {};
