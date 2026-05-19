import { BaseModel } from 'src/common/entities/base.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RoadmapStage = 'foundation' | 'exploration' | 'specialization';
export type RoadmapCategory = 'major' | 'paper' | 'growth';
export type RoadmapPriority = 'high' | 'medium' | 'low';

@Entity('roadmap_tasks')
export class RoadmapTask extends BaseModel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar' })
    stage!: RoadmapStage;

    @Column({ type: 'varchar' })
    category!: RoadmapCategory;

    @Column()
    title!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'varchar' })
    priority!: RoadmapPriority;
}
