package com.reelcms.api.entity.creator;

import com.reelcms.api.dto.Dtos.CreatorAdminDto;
import com.reelcms.api.dto.Dtos.CreatorProfileDto;
import com.reelcms.api.dto.Dtos.CreatorRequest;
import java.util.List;

public interface CreatorService {

    CreatorProfileDto publicProfile(String username);

    List<CreatorAdminDto> adminList();

    CreatorAdminDto create(CreatorRequest request);

    CreatorAdminDto update(String id, CreatorRequest request);
}
