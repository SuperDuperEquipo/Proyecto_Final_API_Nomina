import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NovedadesService } from './novedades.service';
import { Novedad } from './entities/novedad.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Nomina } from '../nomina/entities/nomina.entity';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';
import { TipoNomina } from '../nomina/enums/tipo-nomina.enum';
import { TipoNovedad } from './enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from './enums/subtipo-hora-extra.enum';

describe('NovedadesService', () => {
  let service: NovedadesService;
  let novedadRepository: any;
  let empleadoRepository: any;
  let nominaRepository: any;

  const mockNovedadRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmpleadoRepository = {
    findOneBy: jest.fn(),
  };

  const mockNominaRepository = {
    findOneBy: jest.fn(),
  };

  const empleado = { id: 1, nombre: 'Susana Beltrán' } as Empleado;

  const nominaAbierta: Nomina = {
    id: 1,
    periodo: '2026-07',
    tipo: TipoNomina.REGULAR,
    subtipoEspecial: null,
    motivoVacaciones: null,
    estado: EstadoNomina.ABIERTA,
    fechaAprobacion: null,
  };

  const nominaCerrada: Nomina = {
    ...nominaAbierta,
    id: 2,
    estado: EstadoNomina.CERRADA,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NovedadesService,
        {
          provide: getRepositoryToken(Novedad),
          useValue: mockNovedadRepository,
        },
        {
          provide: getRepositoryToken(Empleado),
          useValue: mockEmpleadoRepository,
        },
        { provide: getRepositoryToken(Nomina), useValue: mockNominaRepository },
      ],
    }).compile();

    service = module.get<NovedadesService>(NovedadesService);
    novedadRepository = module.get(getRepositoryToken(Novedad));
    empleadoRepository = module.get(getRepositoryToken(Empleado));
    nominaRepository = module.get(getRepositoryToken(Nomina));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      empleadoId: 1,
      nominaId: 1,
      tipo: TipoNovedad.HORAS_EXTRA,
      horas: 5,
      subtipoHoraExtra: SubtipoHoraExtra.DIURNA,
      fecha: '2026-07-15',
    };

    it('should create a novedad when empleado exists and nomina is ABIERTA', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      const created = {
        ...dto,
        id: 1,
        fecha: new Date(dto.fecha),
        afectaBasePrestaciones: false,
      };
      novedadRepository.create.mockReturnValue(created);
      novedadRepository.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(empleadoRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(nominaRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(novedadRepository.save).toHaveBeenCalledWith(created);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if empleado does not exist', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(novedadRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if nomina does not exist', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(novedadRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if nomina is not ABIERTA', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaCerrada);

      await expect(service.create({ ...dto, nominaId: 2 })).rejects.toThrow(
        ConflictException,
      );
      expect(novedadRepository.save).not.toHaveBeenCalled();
    });

    it('should force afectaBasePrestaciones to false for LICENCIA_MATERNIDAD regardless of input', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      const licenciaDto = {
        empleadoId: 1,
        nominaId: 1,
        tipo: TipoNovedad.LICENCIA_MATERNIDAD,
        fecha: '2026-07-15',
        afectaBasePrestaciones: true,
      };
      novedadRepository.create.mockImplementation((data: any) => data);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 9 }),
      );

      const result = await service.create(licenciaDto);

      expect(result.afectaBasePrestaciones).toBe(false);
    });

    it('should persist subtipoHoraExtra for a HORAS_EXTRA novedad', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      novedadRepository.create.mockImplementation((data: any) => data);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 11 }),
      );

      const result = await service.create(dto);

      expect(result.subtipoHoraExtra).toBe(SubtipoHoraExtra.DIURNA);
    });

    it('should respect afectaBasePrestaciones = true for a habitual BONIFICACION', async () => {
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      const bonoDto = {
        empleadoId: 1,
        nominaId: 1,
        tipo: TipoNovedad.BONIFICACION,
        monto: 100,
        fecha: '2026-07-15',
        afectaBasePrestaciones: true,
      };
      novedadRepository.create.mockImplementation((data: any) => data);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve({ ...data, id: 10 }),
      );

      const result = await service.create(bonoDto);

      expect(result.afectaBasePrestaciones).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should list novedades applying filters', async () => {
      const lista = [{ id: 1 }, { id: 2 }];
      novedadRepository.find.mockResolvedValue(lista);

      const result = await service.findAll({
        empleadoId: 1,
        nominaId: 1,
        tipo: TipoNovedad.DESCUENTO,
      });

      expect(novedadRepository.find).toHaveBeenCalledWith({
        where: { empleadoId: 1, nominaId: 1, tipo: TipoNovedad.DESCUENTO },
        order: { fecha: 'DESC' },
      });
      expect(result).toBe(lista);
    });

    it('should list all novedades without filters', async () => {
      novedadRepository.find.mockResolvedValue([]);

      await service.findAll();

      expect(novedadRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { fecha: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the novedad if found', async () => {
      const novedad = { id: 1 };
      novedadRepository.findOneBy.mockResolvedValue(novedad);

      const result = await service.findOne(1);

      expect(result).toBe(novedad);
    });

    it('should throw NotFoundException if not found', async () => {
      novedadRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByNomina', () => {
    it('should return novedades of a given nomina period', async () => {
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      const lista = [{ id: 1, nominaId: 1 }];
      novedadRepository.find.mockResolvedValue(lista);

      const result = await service.findByNomina(1);

      expect(nominaRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(novedadRepository.find).toHaveBeenCalledWith({
        where: { nominaId: 1 },
        order: { empleadoId: 'ASC' },
      });
      expect(result).toBe(lista);
    });

    it('should throw NotFoundException if nomina does not exist', async () => {
      nominaRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findByNomina(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const existente = {
      id: 1,
      empleadoId: 1,
      nominaId: 1,
      tipo: TipoNovedad.DESCUENTO,
      monto: 50,
      fecha: new Date('2026-07-15'),
      afectaBasePrestaciones: false,
    } as Novedad;

    it('should update a novedad when nomina is still ABIERTA', async () => {
      novedadRepository.findOneBy.mockResolvedValue(existente);
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.update(1, { monto: 75 });

      expect(result.monto).toBe(75);
      expect(novedadRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if the linked nomina is no longer ABIERTA', async () => {
      novedadRepository.findOneBy.mockResolvedValue(existente);
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaCerrada);

      await expect(service.update(1, { monto: 75 })).rejects.toThrow(
        ConflictException,
      );
      expect(novedadRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if novedad does not exist', async () => {
      novedadRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update(999, { monto: 75 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should force afectaBasePrestaciones = false when tipo is updated to LICENCIA_MATERNIDAD', async () => {
      novedadRepository.findOneBy.mockResolvedValue({
        ...existente,
        afectaBasePrestaciones: true,
      });
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.update(1, {
        tipo: TipoNovedad.LICENCIA_MATERNIDAD,
        afectaBasePrestaciones: true,
      });

      expect(result.afectaBasePrestaciones).toBe(false);
    });

    it('should update fecha when a new fecha is sent in the PATCH', async () => {
      novedadRepository.findOneBy.mockResolvedValue(existente);
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);
      novedadRepository.save.mockImplementation((data: any) =>
        Promise.resolve(data),
      );

      const result = await service.update(1, { fecha: '2026-08-01' });

      expect(result.fecha).toEqual(new Date('2026-08-01'));
    });
  });

  describe('remove', () => {
    const existente = {
      id: 1,
      empleadoId: 1,
      nominaId: 1,
      tipo: TipoNovedad.DESCUENTO,
    } as Novedad;

    it('should delete a novedad when nomina is still ABIERTA', async () => {
      novedadRepository.findOneBy.mockResolvedValue(existente);
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaAbierta);

      await service.remove(1);

      expect(novedadRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw ConflictException if the linked nomina is no longer ABIERTA', async () => {
      novedadRepository.findOneBy.mockResolvedValue(existente);
      empleadoRepository.findOneBy.mockResolvedValue(empleado);
      nominaRepository.findOneBy.mockResolvedValue(nominaCerrada);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(novedadRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if novedad does not exist', async () => {
      novedadRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
