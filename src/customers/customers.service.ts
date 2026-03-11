import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    await this.checkUnique(
      createCustomerDto.identificationNumber,
      createCustomerDto.email,
    );

    const customer = this.customersRepository.create(createCustomerDto);
    return this.customersRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return this.customersRepository.find();
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOneBy({ id });
    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    if (updateCustomerDto.identificationNumber || updateCustomerDto.email) {
      await this.checkUnique(
        updateCustomerDto.identificationNumber,
        updateCustomerDto.email,
        id,
      );
    }

    Object.assign(customer, updateCustomerDto);
    return this.customersRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.softRemove(customer);
  }

  async restore(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    if (!customer.deletedAt) {
      throw new ConflictException('Customer is not deleted');
    }
    await this.customersRepository.restore(id);
    return this.findOne(id);
  }

  private async checkUnique(
    identificationNumber?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    if (identificationNumber) {
      const byIdent = await this.customersRepository.findOneBy({
        identificationNumber,
      });
      if (byIdent && byIdent.id !== excludeId) {
        throw new ConflictException(
          `A customer with identification "${identificationNumber}" already exists`,
        );
      }
    }

    if (email) {
      const byEmail = await this.customersRepository.findOneBy({ email });
      if (byEmail && byEmail.id !== excludeId) {
        throw new ConflictException(
          `A customer with email "${email}" already exists`,
        );
      }
    }
  }
}
