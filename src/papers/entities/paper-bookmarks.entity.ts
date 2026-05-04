import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Paper } from "./papers.entity";
import { User } from "src/users/entities/users.entity";

@Entity()
export class PaperBookmark {
    @PrimaryColumn({
        name: 'paperId',
        type: 'text',
    })
    paperId!: string;

    @PrimaryColumn({
        name: 'userId',
        type: 'int',
    })
    userId!: number;

    @ManyToOne(
        () => Paper,
        (paper) => paper.bookmarkUsers,
        {
            onDelete: 'CASCADE',
        } 
    )
    @JoinColumn({ name: 'paperId' })
    paper!: Paper;

    @ManyToOne(
        () => User, 
        (user) => user.bookmarkPapers,
        {
            onDelete: 'CASCADE',
        }
    )
    @JoinColumn({ name: 'userId' })
    user!: User; 
} 