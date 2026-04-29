import { PartialType } from "@nestjs/mapped-types";
import { CreateHAIpaperDto } from "./create-hai-paper.dto";

export class UpdatHAIpaperDto extends PartialType(CreateHAIpaperDto) {}
