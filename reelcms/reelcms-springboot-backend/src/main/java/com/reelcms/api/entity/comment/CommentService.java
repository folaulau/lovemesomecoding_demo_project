package com.reelcms.api.entity.comment;

import com.reelcms.api.dto.Dtos.CommentDto;
import java.util.List;

public interface CommentService {

    List<CommentDto> forReel(String reelId);

    CommentDto add(String reelId, String body);
}
