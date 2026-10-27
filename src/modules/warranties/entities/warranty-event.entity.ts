import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WarrantyTicket } from './warranty-ticket.entity';
import { WarrantyStatus } from '../enums/warranty-status.enum';

@Entity('warranty_events')
@Index('IDX_warranty_events_ticket_date', ['ticketId', 'createdAt'])
export class WarrantyEvent {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_warranty_events' })
  id!: number;

  @Column('uuid')
  ticketId!: string;

  @ManyToOne(() => WarrantyTicket, (ticket) => ticket.events, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'ticketId',
    foreignKeyConstraintName: 'FK_warranty_events_ticket',
  })
  ticket!: WarrantyTicket;

  @Column({
    type: 'enum',
    enum: WarrantyStatus,
    enumName: 'warranty_status_enum',
  })
  status!: WarrantyStatus;

  @Column('text')
  note!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
