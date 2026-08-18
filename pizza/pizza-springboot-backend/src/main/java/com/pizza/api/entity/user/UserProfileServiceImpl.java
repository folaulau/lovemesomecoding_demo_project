package com.pizza.api.entity.user;

import com.pizza.api.dto.AddressCreateDTO;
import com.pizza.api.dto.AddressDTO;
import com.pizza.api.dto.PaymentMethodCreateDTO;
import com.pizza.api.dto.PaymentMethodDTO;
import com.pizza.api.dto.SetupIntentDTO;
import com.pizza.api.exception.ApiException;
import com.pizza.api.payment.StripeService;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentMethod;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class UserProfileServiceImpl implements UserProfileService {

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private UserAddressRepository addressRepository;

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    @Autowired
    private StripeService stripeService;

    // ================================================================ addresses

    @Override
    @Transactional(readOnly = true)
    public List<AddressDTO> getAddresses(String email) {
        User user = requireUser(email);
        return addressRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public AddressDTO addAddress(String email, AddressCreateDTO dto) {
        User user = requireUser(email);

        UserAddress address = UserAddress.builder()
                .user(user)
                .label(dto.label())
                .recipientName(dto.recipientName())
                .phone(dto.phone())
                .line1(dto.line1())
                .line2(dto.line2())
                .city(dto.city())
                .state(dto.state())
                .postalCode(dto.postalCode())
                .build();

        // The very first address is automatically primary — otherwise a customer could end up
        // with saved addresses and nothing selected at checkout.
        boolean first = addressRepository
                .findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId())
                .isEmpty();
        address.setPrimary(first || Boolean.TRUE.equals(dto.primary()));

        UserAddress saved = addressRepository.saveAndFlush(address);
        if (saved.isPrimary()) {
            demoteOtherAddresses(user.getId(), saved.getId());
        }
        return toDto(saved);
    }

    @Override
    @Transactional
    public AddressDTO updateAddress(String email, UUID addressId, AddressCreateDTO dto) {
        User user = requireUser(email);
        UserAddress address = requireOwnedAddress(user, addressId);

        address.setLabel(dto.label());
        address.setRecipientName(dto.recipientName());
        address.setPhone(dto.phone());
        address.setLine1(dto.line1());
        address.setLine2(dto.line2());
        address.setCity(dto.city());
        address.setState(dto.state());
        address.setPostalCode(dto.postalCode());

        if (Boolean.TRUE.equals(dto.primary())) {
            address.setPrimary(true);
        }

        UserAddress saved = addressRepository.saveAndFlush(address);
        if (saved.isPrimary()) {
            demoteOtherAddresses(user.getId(), saved.getId());
        }
        return toDto(saved);
    }

    @Override
    @Transactional
    public AddressDTO makeAddressPrimary(String email, UUID addressId) {
        User user = requireUser(email);
        UserAddress address = requireOwnedAddress(user, addressId);

        address.setPrimary(true);
        UserAddress saved = addressRepository.saveAndFlush(address);
        demoteOtherAddresses(user.getId(), saved.getId());
        return toDto(saved);
    }

    @Override
    @Transactional
    public void deleteAddress(String email, UUID addressId) {
        User user = requireUser(email);
        UserAddress address = requireOwnedAddress(user, addressId);

        boolean wasPrimary = address.isPrimary();
        address.setDeleted(true);
        addressRepository.saveAndFlush(address);

        // Never leave a customer with addresses but no primary — promote the newest survivor.
        if (wasPrimary) {
            addressRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId()).stream()
                    .findFirst()
                    .ifPresent(next -> {
                        next.setPrimary(true);
                        addressRepository.saveAndFlush(next);
                    });
        }
    }

    // ========================================================= payment methods

    @Override
    @Transactional(readOnly = true)
    public List<PaymentMethodDTO> getPaymentMethods(String email) {
        User user = requireUser(email);
        return paymentMethodRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public SetupIntentDTO createSetupIntent(String email) {
        User user = requireUser(email);
        requireStripe();

        try {
            String customerId =
                    stripeService.ensureCustomer(user.getStripeCustomerId(), user.getEmail(), user.getFullName());
            if (!customerId.equals(user.getStripeCustomerId())) {
                user.setStripeCustomerId(customerId);
                userDAO.save(user);
            }
            return new SetupIntentDTO(
                    stripeService.createSetupIntent(customerId).getClientSecret());
        } catch (StripeException ex) {
            log.error("Stripe refused a SetupIntent for {}", email, ex);
            throw ApiException.badRequest("Could not start card setup: " + ex.getMessage());
        }
    }

    @Override
    @Transactional
    public PaymentMethodDTO addPaymentMethod(String email, PaymentMethodCreateDTO dto) {
        User user = requireUser(email);
        requireStripe();

        try {
            String customerId =
                    stripeService.ensureCustomer(user.getStripeCustomerId(), user.getEmail(), user.getFullName());
            if (!customerId.equals(user.getStripeCustomerId())) {
                user.setStripeCustomerId(customerId);
                userDAO.save(user);
            }

            // Attach so the card can be charged again later, then read back the DISPLAY metadata.
            // We never see or store the card itself — only what Stripe reports about it.
            PaymentMethod stripeMethod = stripeService.attachPaymentMethod(dto.stripePaymentMethodId(), customerId);
            PaymentMethod.Card card = stripeMethod.getCard();

            UserPaymentMethod method = UserPaymentMethod.builder()
                    .user(user)
                    .stripePaymentMethodId(stripeMethod.getId())
                    .brand(card == null ? null : card.getBrand())
                    .last4(card == null ? null : card.getLast4())
                    .expMonth(card == null ? null : Math.toIntExact(card.getExpMonth()))
                    .expYear(card == null ? null : Math.toIntExact(card.getExpYear()))
                    .build();

            boolean first = paymentMethodRepository
                    .findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId())
                    .isEmpty();
            method.setPrimary(first || Boolean.TRUE.equals(dto.primary()));

            UserPaymentMethod saved = paymentMethodRepository.saveAndFlush(method);
            if (saved.isPrimary()) {
                demoteOtherPaymentMethods(user.getId(), saved.getId());
            }
            log.info("Saved a {} ending {} for {}", saved.getBrand(), saved.getLast4(), email);
            return toDto(saved);
        } catch (StripeException ex) {
            log.error("Stripe refused to attach a payment method for {}", email, ex);
            throw ApiException.badRequest("Could not save that card: " + ex.getMessage());
        }
    }

    @Override
    @Transactional
    public PaymentMethodDTO makePaymentMethodPrimary(String email, UUID paymentMethodId) {
        User user = requireUser(email);
        UserPaymentMethod method = requireOwnedPaymentMethod(user, paymentMethodId);

        method.setPrimary(true);
        UserPaymentMethod saved = paymentMethodRepository.saveAndFlush(method);
        demoteOtherPaymentMethods(user.getId(), saved.getId());
        return toDto(saved);
    }

    @Override
    @Transactional
    public void deletePaymentMethod(String email, UUID paymentMethodId) {
        User user = requireUser(email);
        UserPaymentMethod method = requireOwnedPaymentMethod(user, paymentMethodId);

        // Detach at Stripe too, so a "deleted" card genuinely cannot be charged again. Failing to
        // do that would leave a usable token behind — the row would be gone but the card would not.
        if (stripeService.isConfigured()) {
            try {
                stripeService.detachPaymentMethod(method.getStripePaymentMethodId());
            } catch (StripeException ex) {
                log.warn("Could not detach {} at Stripe", method.getStripePaymentMethodId(), ex);
            }
        }

        boolean wasPrimary = method.isPrimary();
        method.setDeleted(true);
        paymentMethodRepository.saveAndFlush(method);

        if (wasPrimary) {
            paymentMethodRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId()).stream()
                    .findFirst()
                    .ifPresent(next -> {
                        next.setPrimary(true);
                        paymentMethodRepository.saveAndFlush(next);
                    });
        }
    }

    // ================================================================== helpers

    private User requireUser(String email) {
        if (email == null) {
            throw ApiException.unauthorized("You must be signed in");
        }
        return userDAO.findByEmail(email).orElseThrow(() -> ApiException.notFound("No account for " + email));
    }

    /**
     * Ownership check.
     *
     * <p>Deliberately a 404, not a 403: telling someone "that exists but is not yours" confirms the
     * id is real. To a caller who does not own it, it simply does not exist.
     */
    private UserAddress requireOwnedAddress(User user, UUID addressId) {
        return addressRepository
                .findByPublicId(addressId)
                .filter(a -> a.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> ApiException.notFound("Address", addressId));
    }

    private UserPaymentMethod requireOwnedPaymentMethod(User user, UUID paymentMethodId) {
        return paymentMethodRepository
                .findByPublicId(paymentMethodId)
                .filter(m -> m.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> ApiException.notFound("Payment method", paymentMethodId));
    }

    /** "Exactly one primary" cannot be a database constraint in MySQL, so it is enforced here. */
    private void demoteOtherAddresses(Long userId, Long keepId) {
        for (UserAddress other : addressRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(userId)) {
            if (!other.getId().equals(keepId) && other.isPrimary()) {
                other.setPrimary(false);
                addressRepository.save(other);
            }
        }
    }

    private void demoteOtherPaymentMethods(Long userId, Long keepId) {
        for (UserPaymentMethod other : paymentMethodRepository.findByUserIdOrderByPrimaryDescCreatedAtDesc(userId)) {
            if (!other.getId().equals(keepId) && other.isPrimary()) {
                other.setPrimary(false);
                paymentMethodRepository.save(other);
            }
        }
    }

    private void requireStripe() {
        if (!stripeService.isConfigured()) {
            throw ApiException.badRequest("Stripe is not configured on the server, so cards cannot be saved. "
                    + "Set pizza.stripe.secret-key and run with the local profile.");
        }
    }

    private AddressDTO toDto(UserAddress a) {
        return new AddressDTO(
                a.getPublicId(),
                a.getLabel(),
                a.getRecipientName(),
                a.getPhone(),
                a.getLine1(),
                a.getLine2(),
                a.getCity(),
                a.getState(),
                a.getPostalCode(),
                a.isPrimary());
    }

    private PaymentMethodDTO toDto(UserPaymentMethod m) {
        return new PaymentMethodDTO(
                m.getPublicId(), m.getBrand(), m.getLast4(), m.getExpMonth(), m.getExpYear(), m.isPrimary());
    }
}
