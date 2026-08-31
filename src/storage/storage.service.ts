import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  async saveReceipt(file: Express.Multer.File) {
    const root = this.config.get<string>('UPLOAD_DIR') || './uploads';
    const dir = join(root, 'receipts');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const extension = extname(file.originalname).toLowerCase() || '.bin';
    const fileName = `${randomUUID()}${extension}`;
    await writeFile(join(dir, fileName), file.buffer);
    const publicBase = (this.config.get<string>('PUBLIC_BASE_URL') || 'http://127.0.0.1:3003').replace(/\/$/, '');
    return { fileName, fileUrl: `${publicBase}/uploads/receipts/${fileName}` };
  }
}
