import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatDto } from './dto/chat.dto';
import { User } from 'src/users/decorator/user.decorator';

@Controller('chatbot')
@ApiBearerAuth()
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('ask')
  @ApiOperation({ description: '챗봇에게 질문하고 답변을 받는 API' })
  ask(
    @User('id') userId: number,
    @Body() dto: ChatDto,
  ) {
    return this.chatbotService.ask(dto, userId);
  }
}
