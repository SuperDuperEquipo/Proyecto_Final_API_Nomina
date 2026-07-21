import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfiguracionAdminService } from './configuracion-admin.service';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';

describe('ConfiguracionAdminService', () => {
  let service: ConfiguracionAdminService;
  let mockManager: any;
  let mockDataSource: any;
  let configRepository: any;
  let tramoRepository: any;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((_entity, data) => data),
    };
    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
    };
    configRepository = { find: jest.fn() };
    tramoRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionAdminService,
        {
          provide: getRepositoryToken(ConfiguracionDeduccion),
          useValue: configRepository,
        },
        { provide: getRepositoryToken(TramoISR), useValue: tramoRepository },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ConfiguracionAdminService>(ConfiguracionAdminService);
  });

  describe('crearConfiguracionDeduccion', () => {
    const dto = {
      vigenteDesde: '2025-05-08',
      issssPctTrabajador: 3,
      issssPctPatronal: 7.5,
      issssTopeBase: 1000,
      afpPctTrabajador: 7.25,
      afpPctPatronal: 8.75,
    };

    it('crea la primera configuración cuando no hay ninguna vigente', async () => {
      mockManager.findOne.mockResolvedValue(null);

      const resultado = await service.crearConfiguracionDeduccion(dto);

      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(resultado.vigenteHasta).toBeNull();
    });

    it('cierra automáticamente la configuración anterior al crear una nueva', async () => {
      const anterior = {
        id: 1,
        vigenteDesde: new Date('2020-01-01'),
        vigenteHasta: null,
      } as ConfiguracionDeduccion;
      mockManager.findOne.mockResolvedValue(anterior);

      await service.crearConfiguracionDeduccion(dto);

      expect(anterior.vigenteHasta).toEqual(new Date('2025-05-08'));
      expect(mockManager.save).toHaveBeenCalledTimes(2); // cierra la anterior + guarda la nueva
    });

    it('rechaza si la nueva vigenteDesde no es posterior a la configuración actual', async () => {
      const anterior = {
        id: 1,
        vigenteDesde: new Date('2026-01-01'),
        vigenteHasta: null,
      } as ConfiguracionDeduccion;
      mockManager.findOne.mockResolvedValue(anterior);

      await expect(service.crearConfiguracionDeduccion(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('crearTramosIsr', () => {
    const tramosValidos = [
      {
        numeroTramo: 1,
        limiteInferior: 0.01,
        limiteSuperior: 550.0,
        porcentaje: 0,
        cuotaFija: 0,
      },
      {
        numeroTramo: 2,
        limiteInferior: 550.01,
        limiteSuperior: 895.24,
        porcentaje: 10,
        cuotaFija: 17.67,
      },
      {
        numeroTramo: 3,
        limiteInferior: 895.25,
        limiteSuperior: 2038.1,
        porcentaje: 20,
        cuotaFija: 60.0,
      },
      {
        numeroTramo: 4,
        limiteInferior: 2038.11,
        limiteSuperior: null,
        porcentaje: 30,
        cuotaFija: 288.57,
      },
    ];

    it('crea los 4 tramos cuando la numeración y los límites son válidos y contiguos', async () => {
      mockManager.find.mockResolvedValue([]);

      const resultado = await service.crearTramosIsr({
        vigenteDesde: '2025-05-08',
        tramos: tramosValidos,
      });

      expect(resultado).toHaveLength(4);
    });

    it('rechaza si falta un tramo (solo 3 en vez de 4)', async () => {
      mockManager.find.mockResolvedValue([]);
      const incompletos = tramosValidos.slice(0, 3);

      await expect(
        service.crearTramosIsr({
          vigenteDesde: '2025-05-08',
          tramos: incompletos as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si hay un hueco entre tramos (limiteInferior no continúa donde terminó el anterior)', async () => {
      mockManager.find.mockResolvedValue([]);
      const conHueco = tramosValidos.map((t) =>
        t.numeroTramo === 2 ? { ...t, limiteInferior: 600.0 } : t,
      );

      await expect(
        service.crearTramosIsr({
          vigenteDesde: '2025-05-08',
          tramos: conHueco as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el tramo 4 trae limiteSuperior (el más alto no debe tenerlo)', async () => {
      mockManager.find.mockResolvedValue([]);
      const conLimiteDeMas = tramosValidos.map((t) =>
        t.numeroTramo === 4 ? { ...t, limiteSuperior: 5000 } : t,
      );

      await expect(
        service.crearTramosIsr({
          vigenteDesde: '2025-05-08',
          tramos: conLimiteDeMas as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cierra automáticamente los 4 tramos anteriores al crear una vigencia nueva', async () => {
      const anteriores = tramosValidos.map((t) => ({
        ...t,
        vigenteDesde: new Date('2020-01-01'),
        vigenteHasta: null,
      }));
      mockManager.find.mockResolvedValue(anteriores);

      await service.crearTramosIsr({
        vigenteDesde: '2025-05-08',
        tramos: tramosValidos,
      });

      anteriores.forEach((t) =>
        expect(t.vigenteHasta).toEqual(new Date('2025-05-08')),
      );
    });
  });
});
