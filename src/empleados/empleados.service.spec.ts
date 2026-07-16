import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadosService } from './empleados.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Empleado, EmpleadoRole } from './entities/empleado.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('EmpleadosService', () => {
  let service: EmpleadosService;
  let repository: any;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmpleadosService,
        {
          provide: getRepositoryToken(Empleado),
          useValue: mockEmpleadoRepository,
        },
      ],
    }).compile();

    service = module.get<EmpleadosService>(EmpleadosService);
    repository = module.get(getRepositoryToken(Empleado));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: any = {
      nombre: 'Susana Beltrán',
      dui: '01234567-8',
      email: 'susana@nomina.com',
      password: 'password123',
      salarioBase: 1200,
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
        fechaIngreso: new Date(dto.fechaIngreso),
        password: 'hashed_password',
      });
      expect(repository.save).toHaveBeenCalledWith(createdEmployee);
      expect(result.password).toBeUndefined();
      expect(result.id).toBe(123);
    });

    it('should throw ConflictException if save fails with duplicate code 23505', async () => {
      repository.create.mockReturnValue(dto);
      repository.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow other errors on save failure', async () => {
      repository.create.mockReturnValue(dto);
      repository.save.mockRejectedValue(new Error('DB Error'));

      await expect(service.create(dto)).rejects.toThrow('DB Error');
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

  describe('update', () => {
    const updateDto: any = {
      salarioBase: 1300,
      password: 'newpassword123',
    };

    it('should successfully update an employee and return updated details', async () => {
      const existingEmployee = { id: 1, nombre: 'Emp 1', password: 'hash1' };
      const updatedEmployee = { id: 1, nombre: 'Emp 1', salarioBase: 1300, password: 'hashed_password' };

      repository.findOneBy.mockResolvedValueOnce(existingEmployee); // In findOne
      repository.update.mockResolvedValue({ affected: 1 });
      repository.findOneBy.mockResolvedValueOnce(updatedEmployee); // After update

      const result = await service.update(1, updateDto);

      expect(repository.update).toHaveBeenCalledWith(1, {
        salarioBase: 1300,
        password: 'hashed_password',
      });
      expect(result.password).toBeUndefined();
      expect(result.salarioBase).toBe(1300);
    });

    it('should throw ConflictException if update fails with duplicate code 23505', async () => {
      const existingEmployee = { id: 1, nombre: 'Emp 1', password: 'hash1' };
      repository.findOneBy.mockResolvedValueOnce(existingEmployee);
      repository.update.mockRejectedValue({ code: '23505' });

      await expect(service.update(1, updateDto)).rejects.toThrow(ConflictException);
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

    it('should not seed admin if count is greater than 0', async () => {
      repository.count.mockResolvedValue(5);

      await service.seedAdmin();

      expect(repository.count).toHaveBeenCalledTimes(1);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
