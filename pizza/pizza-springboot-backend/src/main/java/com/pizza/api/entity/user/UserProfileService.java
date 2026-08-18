package com.pizza.api.entity.user;

import com.pizza.api.dto.AddressCreateDTO;
import com.pizza.api.dto.AddressDTO;
import com.pizza.api.dto.PaymentMethodCreateDTO;
import com.pizza.api.dto.PaymentMethodDTO;
import com.pizza.api.dto.SetupIntentDTO;
import java.util.List;
import java.util.UUID;

/**
 * Everything on a customer's profile.
 *
 * <p>Every method takes the caller's EMAIL, never a user id. The owner comes from the verified
 * token, so there is no parameter an attacker could swap to read someone else's addresses.
 */
public interface UserProfileService {

    // ---- addresses ----
    List<AddressDTO> getAddresses(String email);

    AddressDTO addAddress(String email, AddressCreateDTO dto);

    AddressDTO updateAddress(String email, UUID addressId, AddressCreateDTO dto);

    AddressDTO makeAddressPrimary(String email, UUID addressId);

    void deleteAddress(String email, UUID addressId);

    // ---- payment methods ----
    List<PaymentMethodDTO> getPaymentMethods(String email);

    /** Opens a Stripe SetupIntent so the browser can collect a card without charging it. */
    SetupIntentDTO createSetupIntent(String email);

    PaymentMethodDTO addPaymentMethod(String email, PaymentMethodCreateDTO dto);

    PaymentMethodDTO makePaymentMethodPrimary(String email, UUID paymentMethodId);

    void deletePaymentMethod(String email, UUID paymentMethodId);
}
