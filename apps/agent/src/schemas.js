/**
 * Validador de Schemas de API ultra-leve e resiliente para o 9Router
 */

function validateSchema(schema, data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Corpo da requisição inválido ou ausente."] };
  }

  for (const [key, rule] of Object.entries(schema)) {
    const val = data[key];
    if (rule.required && (val === undefined || val === null || val === "")) {
      errors.push(`Campo obrigatório ausente: '${key}'`);
      continue;
    }
    if (val !== undefined && val !== null) {
      if (rule.type === "array") {
        if (!Array.isArray(val)) {
          errors.push(`Campo '${key}' deve ser uma lista (Array)`);
        }
      } else if (rule.type && typeof val !== rule.type) {
        errors.push(`Campo '${key}' deve ser do tipo ${rule.type}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

const chatSchema = {
  message: { required: false, type: "string" },
  chatId: { required: false, type: "string" },
  userName: { required: false, type: "string" },
  images: { required: false, type: "array" },
};

const moduleToggleSchema = {
  key: { required: true, type: "string" },
};

module.exports = { validateSchema, chatSchema, moduleToggleSchema };
