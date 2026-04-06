import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

/**
 * Establece time_zone de la sesión MySQL en UTC-5 para que las fechas
 * (CREATE/UPDATE y CURRENT_TIMESTAMP) se guarden en hora Colombia.
 */
@Injectable()
export class DatabaseTimezoneService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const tz = this.config.get<string>('DB_TIMEZONE', '-05:00');
    const q = `SET GLOBAL time_zone = ?`;
    try {
      // Ejecutar en varias conexiones del pool para que queden con la zona correcta
      const poolSize = 10;
      await Promise.all(
        Array.from({ length: poolSize }, () => this.dataSource.query(q, [tz])),
      );
    } catch {
      // No fallar el arranque si hay error (ej. DB no disponible aún)
    }
  }
}
