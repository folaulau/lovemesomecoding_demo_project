package com.pizza.api.entity.crust;

import com.pizza.api.dto.CrustCreateDTO;
import com.pizza.api.dto.CrustDTO;
import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.exception.ApiException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class CrustServiceImpl implements CrustService {

    @Autowired
    private CrustDAO crustDAO;

    @Autowired
    private EntityDTOMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<CrustDTO> getActiveCrusts() {
        return mapper.mapCrustsToCrustDTOs(crustDAO.findActive());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CrustDTO> getAllCrusts() {
        return mapper.mapCrustsToCrustDTOs(crustDAO.getAll());
    }

    @Override
    @Transactional
    public CrustDTO createCrust(CrustCreateDTO dto) {
        log.info("Creating crust {}", dto.name());
        if (crustDAO.existsByName(dto.name())) {
            throw ApiException.badRequest("A crust named '" + dto.name() + "' already exists");
        }
        Crust crust = mapper.mapCrustCreateDTOToCrust(dto);
        crust.setActive(dto.active() == null || dto.active());
        crust.setDisplayOrder(dto.displayOrder() == null ? 0 : dto.displayOrder());
        return mapper.mapCrustToCrustDTO(crustDAO.save(crust));
    }

    @Override
    @Transactional
    public CrustDTO updateCrust(UUID id, CrustCreateDTO dto) {
        log.info("Updating crust {}", id);
        Crust crust = crustDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Crust", id));
        crust.setName(dto.name());
        crust.setPriceDelta(dto.priceDelta());
        if (dto.active() != null) {
            crust.setActive(dto.active());
        }
        if (dto.displayOrder() != null) {
            crust.setDisplayOrder(dto.displayOrder());
        }
        return mapper.mapCrustToCrustDTO(crustDAO.save(crust));
    }

    @Override
    @Transactional
    public void deactivateCrust(UUID id) {
        Crust crust = crustDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Crust", id));
        crust.setActive(false);
        crustDAO.save(crust);
    }

    @Override
    @Transactional
    public void deleteCrust(UUID id) {
        Crust crust = crustDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Crust", id));
        crust.setDeleted(true);
        crustDAO.save(crust);
    }
}
