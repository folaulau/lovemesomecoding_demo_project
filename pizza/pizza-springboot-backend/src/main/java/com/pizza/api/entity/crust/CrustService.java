package com.pizza.api.entity.crust;

import com.pizza.api.dto.CrustCreateDTO;
import com.pizza.api.dto.CrustDTO;
import java.util.List;
import java.util.UUID;

public interface CrustService {

    List<CrustDTO> getActiveCrusts();

    List<CrustDTO> getAllCrusts();

    CrustDTO createCrust(CrustCreateDTO dto);

    CrustDTO updateCrust(UUID id, CrustCreateDTO dto);

    void deactivateCrust(UUID id);

    void deleteCrust(UUID id);
}
