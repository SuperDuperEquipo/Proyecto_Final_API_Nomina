import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { ConfiguracionVigenteService } from './configuracion-vigente.service';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';

describe('ConfiguracionVigenteService', () => {
  let service: ConfiguracionVigenteService;
  let configRepository: any;
  let tramoRepository: any;

  const mockConfigRepository = { findOne: jest.fn() };
  const mockTramoRepository = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionVigenteService,
        {
          provide: getRepositoryToken(ConfiguracionDeduccion),
          useValue: mockConfigRepository,
        },
        {
          provide: getRepositoryToken(TramoISR),
          useValue: mockTramoRepository,
        },
      ],
    }).compile();

    service = module.get<ConfiguracionVigenteService>(
      ConfiguracionVigenteService,
    );
    configRepository = module.get(getRepositoryToken(ConfiguracionDeduccion));
    tramoRepository = module.get(getRepositoryToken(TramoISR));
    jest.clearAllMocks();
  });

  describe('obtenerConfiguracionVigente', () => {
    it('retorna la configuración cuando el repositorio la encuentra', async () => {
      const config = {
        id: 1,
        vigenteDesde: new Date('2025-05-08'),
      } as ConfiguracionDeduccion;
      configRepository.findOne.mockResolvedValue(config);

      const resultado = await service.obtenerConfiguracionVigente(
        new Date('2026-07-20'),
      );

      expect(resultado).toEqual(config);
    });

    it('lanza UnprocessableEntityException si no hay configuración para esa fecha', async () => {
      configRepository.findOne.mockResolvedValue(null);

      await expect(
        service.obtenerConfiguracionVigente(new Date('2020-01-01')),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('obtenerTramosIsrVigentes', () => {
    it('retorna los tramos cuando el repositorio los encuentra', async () => {
      const tramos = [{ numeroTramo: 1 }, { numeroTramo: 2 }] as TramoISR[];
      tramoRepository.find.mockResolvedValue(tramos);

      const resultado = await service.obtenerTramosIsrVigentes(
        new Date('2026-07-20'),
      );

      expect(resultado).toEqual(tramos);
    });

    it('lanza UnprocessableEntityException si no hay tramos para esa fecha', async () => {
      tramoRepository.find.mockResolvedValue([]);

      await expect(
        service.obtenerTramosIsrVigentes(new Date('2020-01-01')),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
