import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { NominaCalculoService } from './nomina-calculo.service';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from './enums/subtipo-nomina-especial.enum';

describe('NominaService', () => {
  let service: NominaService;
  let nominaRepository: any;
  let detalleNominaRepository: any;
  let nominaCalculoService: any;

  const mockNominaRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };

  const mockDetalleNominaRepository = {
    find: jest.fn(),
  };

  const mockNominaCalculoService = {
    calcularPeriodoRegular: jest.fn(),
  };

  const nominaAbierta: Nomina = {
    id: 1,
    periodo: '2026-07-Q2',
    tipo: TipoNomina.REGULAR,
    subtipoEspecial: null,
    estado: EstadoNomina.ABIERTA,
    fechaAprobacion: null,
  };

  const nominaCerrada: Nomina = {
    ...nominaAbierta,
    id: 2,
    estado: EstadoNomina.CERRADA,
  };

  const nominaAprobada: Nomina = {
    ...nominaAbierta,
    id: 3,
    estado: EstadoNomina.APROBADA,
    fechaAprobacion: new Date('2026-07-16'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NominaService,
        { provide: getRepositoryToken(Nomina), useValue: mockNominaRepository },
        {
          provide: getRepositoryToken(DetalleNomina),
          useValue: mockDetalleNominaRepository,
        },
        { provide: NominaCalculoService, useValue: mockNominaCalculoService },
      ],
    }).compile();

    service = module.get<NominaService>(NominaService);
    nominaRepository = module.get(getRepositoryToken(Nomina));
    detalleNominaRepository = module.get(getRepositoryToken(DetalleNomina));
    nominaCalculoService = module.get(NominaCalculoService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should default tipo to REGULAR and estado to ABIERTA', async () => {
      const dto = { periodo: '2026-07-Q2' };
      nominaRepository.create.mockImplementation((data: any) => data);
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 1 }),
      );

      const result = await service.create(dto);

      expect(result.tipo).toBe(TipoNomina.REGULAR);
      expect(result.estado).toBe(EstadoNomina.ABIERTA);
    });

    it('should persist subtipoEspecial for a nomina ESPECIAL', async () => {
      const dto = {
        periodo: '2026-01-Q1',
        tipo: TipoNomina.ESPECIAL,
        subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
      };
      nominaRepository.create.mockImplementation((data: any) => data);
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 2 }),
      );

      const result = await service.create(dto);

      expect(result.tipo).toBe(TipoNomina.ESPECIAL);
      expect(result.subtipoEspecial).toBe(SubtipoNominaEspecial.QUINCENA_25);
    });
  });

  describe('findAll', () => {
    it('should list nominas applying filters', async () => {
      const lista = [nominaAbierta];
      nominaRepository.find.mockResolvedValue(lista);

      const result = await service.findAll({
        estado: EstadoNomina.ABIERTA,
        tipo: TipoNomina.REGULAR,
        periodo: '2026-07-Q2',
      });

      expect(nominaRepository.find).toHaveBeenCalledWith({
        where: {
          estado: EstadoNomina.ABIERTA,
          tipo: TipoNomina.REGULAR,
          periodo: '2026-07-Q2',
        },
        order: { id: 'DESC' },
      });
      expect(result).toBe(lista);
    });

    it('should list all nominas without filters', async () => {
      nominaRepository.find.mockResolvedValue([]);

      await service.findAll();

      expect(nominaRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { id: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the nomina if found', async () => {
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);

      const result = await service.findOne(1);

      expect(result).toBe(nominaAbierta);
    });

    it('should throw NotFoundException if not found', async () => {
      nominaRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cerrar', () => {
    it('should transition ABIERTA -> CERRADA and run the calculo engine for REGULAR', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAbierta });
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );
      nominaCalculoService.calcularPeriodoRegular.mockResolvedValue([]);

      const result = await service.cerrar(1);

      expect(nominaCalculoService.calcularPeriodoRegular).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );
      expect(result.estado).toBe(EstadoNomina.CERRADA);
    });

    it('should not invoke the calculo engine for tipo ESPECIAL', async () => {
      const nominaEspecial = {
        ...nominaAbierta,
        id: 4,
        tipo: TipoNomina.ESPECIAL,
        subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
      };
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaEspecial });
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.cerrar(4);

      expect(
        nominaCalculoService.calcularPeriodoRegular,
      ).not.toHaveBeenCalled();
      expect(result.estado).toBe(EstadoNomina.CERRADA);
    });

    it('should throw ConflictException if not ABIERTA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaCerrada });

      await expect(service.cerrar(2)).rejects.toThrow(ConflictException);
      expect(nominaRepository.save).not.toHaveBeenCalled();
      expect(
        nominaCalculoService.calcularPeriodoRegular,
      ).not.toHaveBeenCalled();
    });
  });

  describe('obtenerDetalle', () => {
    it('should return the detalle rows for an existing nomina', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaCerrada });
      const detalles = [{ id: 1, nominaId: 2, empleadoId: 1 }];
      detalleNominaRepository.find.mockResolvedValue(detalles);

      const result = await service.obtenerDetalle(2);

      expect(detalleNominaRepository.find).toHaveBeenCalledWith({
        where: { nominaId: 2 },
        order: { empleadoId: 'ASC' },
      });
      expect(result).toBe(detalles);
    });

    it('should throw NotFoundException if nomina does not exist', async () => {
      nominaRepository.findOneBy.mockResolvedValue(null);

      await expect(service.obtenerDetalle(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reabrir', () => {
    it('should transition CERRADA -> ABIERTA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaCerrada });
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.reabrir(2);

      expect(result.estado).toBe(EstadoNomina.ABIERTA);
    });

    it('should throw ConflictException if the nomina is not CERRADA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAbierta });

      await expect(service.reabrir(1)).rejects.toThrow(ConflictException);
      expect(nominaRepository.save).not.toHaveBeenCalled();
    });

    it('should never reopen an APROBADA nomina', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAprobada });

      await expect(service.reabrir(3)).rejects.toThrow(ConflictException);
      expect(nominaRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('aprobar', () => {
    it('should transition CERRADA -> APROBADA and stamp fechaAprobacion', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaCerrada });
      nominaRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.aprobar(2);

      expect(result.estado).toBe(EstadoNomina.APROBADA);
      expect(result.fechaAprobacion).toBeInstanceOf(Date);
    });

    it('should throw ConflictException if the nomina is still ABIERTA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAbierta });

      await expect(service.aprobar(1)).rejects.toThrow(ConflictException);
      expect(nominaRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if already APROBADA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAprobada });

      await expect(service.aprobar(3)).rejects.toThrow(ConflictException);
      expect(nominaRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a nomina when ABIERTA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaAbierta });

      await service.remove(1);

      expect(nominaRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw ConflictException if not ABIERTA', async () => {
      nominaRepository.findOneBy.mockResolvedValue({ ...nominaCerrada });

      await expect(service.remove(2)).rejects.toThrow(ConflictException);
      expect(nominaRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if nomina does not exist', async () => {
      nominaRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
