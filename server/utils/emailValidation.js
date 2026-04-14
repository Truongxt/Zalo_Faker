const { validate } = require("deep-email-validator");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const validateRegistrationEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return {
      isAllowed: false,
      normalizedEmail,
      reason: "required",
      message: "Email là bắt buộc",
    };
  }

  try {
    const result = await validate({
      email: normalizedEmail,
      validateRegex: true,
      validateMx: true,
      validateDisposable: true,
      validateSMTP: false,
    });

    const validators = result?.validators || {};

    if (validators.regex?.valid === false) {
      return {
        isAllowed: false,
        normalizedEmail,
        reason: "invalid_format",
        message: "Định dạng email không hợp lệ",
      };
    }

    if (validators.disposable?.valid === false) {
      return {
        isAllowed: false,
        normalizedEmail,
        reason: "disposable",
        message: "Không chấp nhận email tạm thời",
      };
    }

    if (validators.mx?.valid === false) {
      return {
        isAllowed: false,
        normalizedEmail,
        reason: "invalid_domain",
        message: "Tên miền email không thể nhận thư",
      };
    }

    return {
      isAllowed: true,
      normalizedEmail,
      reason: result?.valid ? "validated" : "uncertain",
    };
  } catch (_error) {
    // Soft fallback: do not block signup OTP requests if validator is unavailable.
    return {
      isAllowed: true,
      normalizedEmail,
      reason: "validator_unavailable",
    };
  }
};

module.exports = {
  validateRegistrationEmail,
};
