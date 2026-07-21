import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadosService } from './empleados.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Empleado, EmpleadoRole } from './entities/empleado.entity';
import { HistorialSalario } from './entities/historial-salario.entity';
import { TipoDocumento } from './entities/tipo-documento.enum';
import { SectorEconomico } from './entities/sector-economico.enum';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('EmpleadosService', () => {
  let service: EmpleadosService;
  let repository: any;
  let historialRepository: any;

  const mockEmpleadoRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockHistorialSalarioRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmpleadosService,
        {
          provide: getRepositoryToken(Empleado),
          useValue: mockEmpleadoRepository,
        },
        {
          provide: getRepositoryToken(HistorialSalario),
          useValue: mockHistorialSalarioRepository,
        },
      ],
    }).compile();

    service = module.get<EmpleadosService>(EmpleadosService);
    repository = module.get(getRepositoryToken(Empleado));
    historialRepository = module.get(getRepositoryToken(HistorialSalario));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: any = {
      nombre: 'Susana Beltrán',
      tipoDocumento: TipoDocumento.DUI,
      documentoIdentidad: '01234567-8',
      email: 'susana@nomina.com',
      password: 'password123',
      salarioBase: 1200,
      sectorEconomico: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
      cargo: 'Desarrollador Backend',
      area: 'Tecnología',
      fechaIngreso: '2026-07-15',
      afp: 'AFP Crecer',
      rol: EmpleadoRole.ADMIN,
    };

    it('should successfully create and save an employee', async () => {
      const createdEmployee = {
        ...dto,
        id: 123,
        fechaIngreso: new Date(dto.fechaIngreso),
        password: 'hashed_password',
      };

      repository.create.mockReturnValue(createdEmployee);
      repository.save.mockResolvedValue(createdEmployee);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        sectorEconomico: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
        fechaIngreso: new Date(dto.fechaIngreso),
        password: 'hashed_password',
      });
      expect(repository.save).toHaveBeenCalledWith(createdEmployee);
      expect(result.password).toBeUndefined();
      expect(result.id).toBe(123);
    });

    it('should throw BadRequestException if DUI format is invalid', async () => {
      const invalidDuiDto = { ...dto, documentoIdentidad: 'invalid-dui' };
      await expect(service.create(invalidDuiDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if passport format is invalid', async () => {
      const invalidPassportDto = {
        ...dto,
        tipoDocumento: TipoDocumento.PASAPORTE,
        documentoIdentidad: 'short',
      };
      await expect(service.create(invalidPassportDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if salary is below sector minimum wage', async () => {
      const lowSalaryDto = { ...dto, salarioBase: 100 }; // Minimum is 408.80
      await expect(service.create(lowSalaryDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if save fails with duplicate code 23505', async () => {
      repository.create.mockReturnValue(dto);
      repository.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return a list of employees without passwords', async () => {
      const dbList = [
        { id: 1, nombre: 'Emp 1', password: 'hash1' },
        { id: 2, nombre: 'Emp 2', password: 'hash2' },
      ];
      repository.find.mockResolvedValue(dbList);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].password).toBeUndefined();
      expect(result[1].password).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return the employee if found, without password', async () => {
      const employee = { id: 1, nombre: 'Emp 1', password: 'hash1' };
      repository.findOneBy.mockResolvedValue(employee);

      const result = await service.findOne(1);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result.password).toBeUndefined();
      expect(result.nombre).toBe('Emp 1');
    });

    it('should throw NotFoundException if employee is not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDocumentoIdentidadWithPassword', () => {
    it('should return employee when found', async () => {
      const employee = {
        id: 1,
        documentoIdentidad: '00000000-0',
        password: 'hash',
      };
      repository.findOne.mockResolvedValue(employee);

      const result =
        await service.findByDocumentoIdentidadWithPassword('00000000-0');
      expect(result).toBe(employee);
    });
  });

  describe('update', () => {
    const updateDto: any = {
      salarioBase: 1300,
      password: 'newpassword123',
    };

    it('should successfully update an employee and log salary change', async () => {
      const existingEmployee = {
        id: 1,
        nombre: 'Emp 1',
        password: 'hash1',
        salarioBase: 1200,
        tipoDocumento: TipoDocumento.DUI,
        documentoIdentidad: '01234567-8',
        sectorEconomico: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
      };
      const updatedEmployee = {
        id: 1,
        nombre: 'Emp 1',
        salarioBase: 1300,
        password: 'hashed_password',
      };

      repository.findOneBy.mockResolvedValueOnce(existingEmployee); // Initial fetch in update
      repository.update.mockResolvedValue({ affected: 1 });
      repository.findOneBy.mockResolvedValueOnce(updatedEmployee); // Fetch after update

      const result = await service.update(1, updateDto);

      expect(historialRepository.save).toHaveBeenCalledWith({
        empleadoId: 1,
        salarioAnterior: 1200,
        salarioNuevo: 1300,
        motivo: 'Actualización de salario base',
      });
      expect(repository.update).toHaveBeenCalledWith(1, {
        salarioBase: 1300,
        password: 'hashed_password',
      });
      expect(result.password).toBeUndefined();
      expect(result.salarioBase).toBe(1300);
    });
  });

  describe('remove', () => {
    it('should delete the employee successfully', async () => {
      repository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(repository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if no rows were affected', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('seedAdmin', () => {
    it('should seed admin if count is 0', async () => {
      repository.count.mockResolvedValue(0);
      repository.create.mockReturnValue({});
      repository.save.mockResolvedValue({});

      await service.seedAdmin();

      expect(repository.count).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });
});
