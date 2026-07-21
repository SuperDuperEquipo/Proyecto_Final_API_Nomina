import { Test, TestingModule } from '@nestjs/testing';
import { NovedadesController } from './novedades.controller';
import { NovedadesService } from './novedades.service';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { UpdateNovedadDto } from './dto/update-novedad.dto';
import { TipoNovedad } from './enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from './enums/subtipo-hora-extra.enum';

describe('NovedadesController', () => {
  let controller: NovedadesController;
  let service: any;

  const mockNovedadesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByNomina: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NovedadesController],
      providers: [{ provide: NovedadesService, useValue: mockNovedadesService }],
    }).compile();

    controller = module.get<NovedadesController>(NovedadesController);
    service = module.get<NovedadesService>(NovedadesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should invoke service.create with the dto and return the response', async () => {
      const dto: CreateNovedadDto = {
        empleadoId: 1,
        nominaId: 1,
        tipo: TipoNovedad.HORAS_EXTRA,
        horas: 5,
        subtipoHoraExtra: SubtipoHoraExtra.DIURNA,
        fecha: '2026-07-15',
      };
      const mockResponse = { id: 1, ...dto };
      service.create.mockResolvedValue(mockResponse);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockResponse);
    });
  });

  describe('findAll', () => {
    it('should forward parsed filters to service.findAll', async () => {
      const mockList = [{ id: 1 }, { id: 2 }];
      service.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll('1', '2', TipoNovedad.BONIFICACION);

      expect(service.findAll).toHaveBeenCalledWith({
        empleadoId: 1,
        nominaId: 2,
        tipo: TipoNovedad.BONIFICACION,
      });
      expect(result).toBe(mockList);
    });

    it('should pass undefined filters when no query params are given', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith({
        empleadoId: undefined,
        nominaId: undefined,
        tipo: undefined,
      });
    });
  });

  describe('findByNomina', () => {
    it('should invoke service.findByNomina with the parsed id', async () => {
      const mockList = [{ id: 1 }];
      service.findByNomina.mockResolvedValue(mockList);

      const result = await controller.findByNomina('1');

      expect(service.findByNomina).toHaveBeenCalledWith(1);
      expect(result).toBe(mockList);
    });
  });

  describe('findOne', () => {
    it('should invoke service.findOne with the parsed id', async () => {
      const mockNovedad = { id: 1 };
      service.findOne.mockResolvedValue(mockNovedad);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(mockNovedad);
    });
  });

  describe('update', () => {
    it('should invoke service.update with the parsed id and dto', async () => {
      const dto: UpdateNovedadDto = { monto: 75 };
      const mockUpdated = { id: 1, monto: 75 };
      service.update.mockResolvedValue(mockUpdated);

      const result = await controller.update('1', dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(mockUpdated);
    });
  });

  describe('remove', () => {
    it('should invoke service.remove with the parsed id', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });
  });
});
