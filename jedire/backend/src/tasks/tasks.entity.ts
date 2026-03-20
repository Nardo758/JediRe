import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../auth/user.entity';
import { Deal } from '../deals/deal.entity';

export enum TaskCategory {
  DUE_DILIGENCE = 'due_diligence',
  FINANCING = 'financing',
  LEGAL = 'legal',
  CONSTRUCTION = 'construction',
  LEASING = 'leasing',
  PROPERTY_MANAGEMENT = 'property_management',
  REPORTING = 'reporting',
  COMMUNICATION = 'communication',
  ANALYSIS = 'analysis',
  OTHER = 'other',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskCategory,
  })
  category: TaskCategory;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({ name: 'deal_id', nullable: true })
  dealId: number;

  @ManyToOne(() => Deal, { nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal: Deal;

  @Column({ name: 'property_id', nullable: true })
  propertyId: number;

  @Column({ name: 'email_id', length: 100, nullable: true })
  emailId: string;

  @Column({ name: 'assigned_to', nullable: true })
  assignedToId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User;

  @Column({ name: 'created_by', nullable: true })
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'due_date', type: 'timestamp with time zone', nullable: true })
  dueDate: Date;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @Column({ length: 50, default: 'manual' })
  source: string;

  @Column({ name: 'blocked_reason', type: 'text', nullable: true })
  blockedReason: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
