import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { EmpleadoRole } from './entities/empleado.entity';

describe('EmpleadosController', () => {
  let controller: EmpleadosController;
  let service: any;

  const mockEmpleadosService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpleadosController],
      providers: [
        {
          provide: EmpleadosService,
          useValue: mockEmpleadosService,
        },
      ],
    }).compile();

    controller = module.get<EmpleadosController>(EmpleadosController);
    service = module.get<EmpleadosService>(EmpleadosService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should invoke service.create with dto and return the response', async () => {
      const dto: CreateEmpleadoDto = {
        nombre: 'Juan Pérez',
        dui: '00000001-2',
        email: 'juan@nomina.com',
        password: 'password123',
        salarioBase: 850,
        cargo: 'Auxiliar',
        area: 'Finanzas',
        fechaIngreso: '2026-07-15',
        afp: 'AFP Confía',
        rol: EmpleadoRole.EMPLEADO,
      };

      const mockResponse = { id: 1, ...dto };
      delete mockResponse.password;

      service.create.mockResolvedValue(mockResponse);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockResponse);
    });
  });

  describe('findAll', () => {
    it('should invoke service.findAll and return a list of employees', async () => {
      const mockList = [
        { id: 1, nombre: 'Emp 1' },
        { id: 2, nombre: 'Emp 2' },
      ];
      service.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockList);
    });
  });

  describe('findOne', () => {
    it('should invoke service.findOne and return a single employee', async () => {
      const mockEmployee = { id: 1, nombre: 'Emp 1' };
      service.findOne.mockResolvedValue(mockEmployee);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe(mockEmployee);
    });
  });

  describe('update', () => {
    it('should invoke service.update and return the updated employee', async () => {
      const updateDto: UpdateEmpleadoDto = {
        salarioBase: 900,
      };
      const mockUpdatedEmployee = { id: 1, nombre: 'Emp 1', salarioBase: 900 };
      service.update.mockResolvedValue(mockUpdatedEmployee);

      const result = await controller.update('1', updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toBe(mockUpdatedEmployee);
    });
  });

  describe('remove', () => {
    it('should invoke service.remove and return undefined', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });
  });
});
