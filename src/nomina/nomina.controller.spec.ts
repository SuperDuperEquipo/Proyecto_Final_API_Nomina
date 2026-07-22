import { Test, TestingModule } from '@nestjs/testing';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { CreateNominaDto } from './dto/create-nomina.dto';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';

describe('NominaController', () => {
  let controller: NominaController;
  let service: any;

  const mockNominaService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    cerrar: jest.fn(),
    reabrir: jest.fn(),
    aprobar: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NominaController],
      providers: [{ provide: NominaService, useValue: mockNominaService }],
    }).compile();

    controller = module.get<NominaController>(NominaController);
    service = module.get<NominaService>(NominaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should invoke service.create with the dto and return the response', async () => {
      const dto: CreateNominaDto = { periodo: '2026-07-Q2' };
      const mockResponse = { id: 1, ...dto };
      service.create.mockResolvedValue(mockResponse);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockResponse);
    });
  });

  describe('findAll', () => {
    it('should forward query params to service.findAll', async () => {
      const mockList = [{ id: 1 }];
      service.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll(
        EstadoNomina.ABIERTA,
        TipoNomina.REGULAR,
        '2026-07-Q2',
      );

      expect(service.findAll).toHaveBeenCalledWith({
        estado: EstadoNomina.ABIERTA,
        tipo: TipoNomina.REGULAR,
        periodo: '2026-07-Q2',
      });
      expect(result).toBe(mockList);
    });

    it('should pass undefined filters when no query params are given', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith({
        estado: undefined,
        tipo: undefined,
        periodo: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should invoke service.findOne with the parsed id', async () => {
      const mockNomina = { id: 1 };
      service.findOne.mockResolvedValue(mockNomina);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(mockNomina);
    });
  });

  describe('cerrar', () => {
    it('should invoke service.cerrar with the parsed id', async () => {
      const mockNomina = { id: 1, estado: EstadoNomina.CERRADA };
      service.cerrar.mockResolvedValue(mockNomina);

      const result = await controller.cerrar('1');

      expect(service.cerrar).toHaveBeenCalledWith(1);
      expect(result).toBe(mockNomina);
    });
  });

  describe('reabrir', () => {
    it('should invoke service.reabrir with the parsed id', async () => {
      const mockNomina = { id: 1, estado: EstadoNomina.ABIERTA };
      service.reabrir.mockResolvedValue(mockNomina);

      const result = await controller.reabrir('1');

      expect(service.reabrir).toHaveBeenCalledWith(1);
      expect(result).toBe(mockNomina);
    });
  });

  describe('aprobar', () => {
    it('should invoke service.aprobar with the parsed id', async () => {
      const mockNomina = { id: 1, estado: EstadoNomina.APROBADA };
      service.aprobar.mockResolvedValue(mockNomina);

      const result = await controller.aprobar('1');

      expect(service.aprobar).toHaveBeenCalledWith(1);
      expect(result).toBe(mockNomina);
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
