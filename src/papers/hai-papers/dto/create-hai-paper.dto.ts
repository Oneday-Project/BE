export class CreateHAIpaperDto {
    doi?: string;

    title!: string;

    authors!: string[];

    academic_advisor?: string;

    department?: string;

    abstract!: string;

    publishedYear!: string;
    
    pdfUrl!: string;
}