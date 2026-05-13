import { Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Store } from './entities/store.entity';
import { Repository } from 'typeorm';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store) private storeRepository: Repository<Store>,
  ) {}
  create(body: CreateStoreDto) {
    const store = this.storeRepository.create(body);
    store.createdAt = new Date();
    return this.storeRepository.save(store);
  }

  findAll() {
    return this.storeRepository.find();
  }

  findOne(id: string) {
    return this.storeRepository.findOneBy({ id });
  }

  update(id: string, updateStoreDto: UpdateStoreDto) {
    return this.storeRepository.update(id, updateStoreDto);
  }

  remove(id: string) {
    return this.storeRepository.delete(id);
  }
}
