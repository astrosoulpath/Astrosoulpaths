import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service';

const CHAT_BUCKET = 'chat';

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

const FILE_MIME_TYPES =
  new Set([
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
  ]);

const MIME_EXTENSION_MAP:
  Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/x-zip-compressed':
      '.zip',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      '.docx',
    'application/vnd.ms-excel':
      '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      '.xlsx',
    'text/plain': '.txt',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
  };

type UploadFolder =
  | 'images'
  | 'files';

@Injectable()
export class ChatUploadService {
  private readonly logger =
    new Logger(
      ChatUploadService.name,
    );

  constructor(
    private readonly supabaseService: SupabaseService,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    callSessionId: string,
  ) {
    const normalizedCallSessionId =
      this.normalizeCallSessionId(
        callSessionId,
      );

    this.validateFileExists(
      file,
      'Image',
    );

    this.validateMimeType(
      file.mimetype,
      IMAGE_MIME_TYPES,
      'Unsupported image type',
    );

    this.validateFileSize(
      file.size,
      MAX_IMAGE_SIZE,
      'Image exceeds 10 MB',
    );

    return this.upload(
      file,
      normalizedCallSessionId,
      'images',
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    callSessionId: string,
  ) {
    const normalizedCallSessionId =
      this.normalizeCallSessionId(
        callSessionId,
      );

    this.validateFileExists(
      file,
      'File',
    );

    this.validateMimeType(
      file.mimetype,
      FILE_MIME_TYPES,
      'Unsupported file type',
    );

    this.validateFileSize(
      file.size,
      MAX_FILE_SIZE,
      'File exceeds 20 MB',
    );

    return this.upload(
      file,
      normalizedCallSessionId,
      'files',
    );
  }

  private validateFileExists(
    file:
      | Express.Multer.File
      | undefined,
    label: string,
  ): asserts file is Express.Multer.File {
    if (
      !file ||
      !file.buffer ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(
        `${label} is required`,
      );
    }
  }

  private validateMimeType(
    mimeType: string,
    allowedMimeTypes: Set<string>,
    errorMessage: string,
  ): void {
    const normalizedMimeType =
      mimeType?.trim().toLowerCase();

    if (
      !normalizedMimeType ||
      !allowedMimeTypes.has(
        normalizedMimeType,
      )
    ) {
      throw new BadRequestException(
        errorMessage,
      );
    }
  }

  private validateFileSize(
    size: number,
    maxSize: number,
    errorMessage: string,
  ): void {
    if (
      !Number.isFinite(size) ||
      size <= 0
    ) {
      throw new BadRequestException(
        'Uploaded file is empty or invalid',
      );
    }

    if (size > maxSize) {
      throw new BadRequestException(
        errorMessage,
      );
    }
  }

  private normalizeCallSessionId(
    callSessionId: string,
  ): string {
    const normalized =
      callSessionId?.trim();

    if (!normalized) {
      throw new BadRequestException(
        'Call session ID is required',
      );
    }

    return normalized;
  }

  private getSafeExtension(
    originalName: string,
    mimeType: string,
  ): string {
    const originalExtension =
      extname(
        originalName ?? '',
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9.]/g,
          '',
        );

    if (
      originalExtension &&
      originalExtension.length <=
        10
    ) {
      return originalExtension;
    }

    return (
      MIME_EXTENSION_MAP[
        mimeType.toLowerCase()
      ] ?? ''
    );
  }

  private sanitizeOriginalName(
    originalName: string,
  ): string {
    const normalized =
      originalName
        ?.trim()
        .replace(
          /[^\w.\- ]+/g,
          '',
        )
        .replace(
          /\s+/g,
          ' ',
        );

    return (
      normalized ||
      'attachment'
    );
  }

  private async upload(
    file: Express.Multer.File,
    callSessionId: string,
    folder: UploadFolder,
  ) {
    const normalizedMimeType =
      file.mimetype
        .trim()
        .toLowerCase();

    const extension =
      this.getSafeExtension(
        file.originalname,
        normalizedMimeType,
      );

    const storagePath =
      `${callSessionId}/${folder}/${randomUUID()}${extension}`;

    const client =
      this.supabaseService.getStorageClient();

    try {
      const {
        error: uploadError,
      } =
        await client.storage
          .from(CHAT_BUCKET)
          .upload(
            storagePath,
            file.buffer,
            {
              contentType:
                normalizedMimeType,

              upsert:
                false,

              cacheControl:
                '3600',
            },
          );

      if (uploadError) {
        this.logger.error(
          `Chat upload failed: ${uploadError.message}`,
        );

        throw new BadRequestException(
          uploadError.message,
        );
      }

      const {
        data: publicData,
      } =
        client.storage
          .from(CHAT_BUCKET)
          .getPublicUrl(
            storagePath,
          );

      const publicUrl =
        publicData
          ?.publicUrl
          ?.trim();

      if (!publicUrl) {
        await client.storage
          .from(CHAT_BUCKET)
          .remove([
            storagePath,
          ])
          .catch(() => undefined);

        throw new InternalServerErrorException(
          'Unable to generate uploaded file URL',
        );
      }

      return {
        success: true,

        message:
          folder ===
          'images'
            ? 'Image uploaded successfully'
            : 'File uploaded successfully',

        data: {
          url:
            publicUrl,

          path:
            storagePath,

          fileName:
            this.sanitizeOriginalName(
              file.originalname,
            ),

          mimeType:
            normalizedMimeType,

          size:
            file.size,

          type:
            folder ===
            'images'
              ? ('IMAGE' as const)
              : ('FILE' as const),
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof
          BadRequestException ||
        error instanceof
          InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        'Unexpected chat upload error',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to upload chat attachment',
      );
    }
  }
}