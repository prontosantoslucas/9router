// Leads iniciais — clínicas levantadas nas pesquisas anteriores (Instagram +
// LinkedIn donos com contato). Carregados na primeira execução da máquina.
// Cada lead: id, name, niche, city, instagram, whatsapp, contactName, context.
//
// niche: 'odonto' | 'estetica' | 'vet'
// status inicial: 'novo' (a fila move pra 'gerado' → 'enviado' → 'respondeu'/'sem_resposta'/'descartado')

export const SEED_LEADS = [
  // ── Prioridade: têm contato direto (LinkedIn donos + telefone público) ──
  { name: "Clínica Kazoku (Odonto + Estética)", niche: "odonto", city: "São Paulo/SP", instagram: "@kzkodontologia", whatsapp: "1126512328", contactName: "Bruno Nakanishi", context: "10+ anos no Anália Franco, foco em harmonização e implantes. Sócio-fundador Bruno." },
  { name: "Clínica Luminar", niche: "estetica", city: "Sorocaba/SP", instagram: "", whatsapp: "15991696190", contactName: "Miguel Klosowski", context: "Odontologia + estética + harmonização facial. Site próprio. Contato só WhatsApp manual." },
  { name: "Clínica Odontológica Enamel", niche: "odonto", city: "São Paulo/SP", instagram: "", whatsapp: "1122038153", contactName: "Marcia Mota", context: "Sem site próprio, presença via Doctoralia. Reviews em clareamento e ortodontia." },
  { name: "Animália Clínica Vet & Pet Shop", niche: "vet", city: "Luís Eduardo Magalhães/BA", instagram: "@animalia.vet.pet", whatsapp: "77981485994", contactName: "Camilo Macedo", context: "2 unidades, forte no Facebook, sem site próprio. Camilo é criador de conteúdo (3k LinkedIn)." },
  { name: "Clínica Veterinária ArcaVet 24h", niche: "vet", city: "São Paulo/SP", instagram: "@clinica.arcavet", whatsapp: "11975796088", contactName: "Vitor Couto", context: "24h Zona Leste. TEM 2 domínios rodando (arcavet.com.br + clinicaarcavet.com.br), agenda via Petlove — oferecer consolidação." },

  // ── Odontologia — São Paulo (Instagram) ──
  { name: "Odonto e Cia", niche: "odonto", city: "São Paulo/SP", instagram: "@clinica_odontoecia", whatsapp: "", contactName: "", context: "8,9k seguidores, bio com agendamento." },
  { name: "Hori Clínica Odontológica", niche: "odonto", city: "São Paulo/SP", instagram: "@horiclinica", whatsapp: "", contactName: "", context: "Itaim Bibi, 38k seguidores, foco estético." },
  { name: "Clínica Odonto Kurita", niche: "odonto", city: "São Paulo/SP", instagram: "@odonto_kurita", whatsapp: "", contactName: "", context: "Butantã, 28k seguidores, Implantes/Invisalign." },
  { name: "Dentista Popular", niche: "odonto", city: "São Paulo/SP", instagram: "@_dentistapopular1", whatsapp: "1156227786", contactName: "", context: "Av. Cupecê, Jd. Prudência." },
  { name: "Clínica Odontológica Paulista", niche: "odonto", city: "São Paulo/SP", instagram: "@paulistaclinicaodontologica", whatsapp: "", contactName: "", context: "3,8k seguidores, implantes/ortodontia." },
  { name: "Well Clinic Odontologia", niche: "odonto", city: "São Paulo/SP", instagram: "@wellclinic", whatsapp: "", contactName: "", context: "10k seguidores." },
  { name: "Dental Company", niche: "odonto", city: "São Paulo/SP", instagram: "@dentalcompanybr", whatsapp: "", contactName: "", context: "Santo Amaro, implantes e ortodontia." },
  { name: "DenteFix Odontologia", niche: "odonto", city: "São Paulo/SP", instagram: "@dentefixodontologia", whatsapp: "", contactName: "", context: "Jardim São Paulo." },
  { name: "Planet Dente", niche: "odonto", city: "São Paulo/SP", instagram: "@planetdentesp", whatsapp: "", contactName: "", context: "SP capital." },

  // ── Estética — Rio de Janeiro (Instagram) ──
  { name: "JK Estética Avançada", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@jkesteticaavancadarj", whatsapp: "21999033288", contactName: "", context: "109k seguidores. Grande — pode ter agência." },
  { name: "Beauty Corp", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@clinicabeautycorp", whatsapp: "", contactName: "", context: "Centro RJ, 13 anos, avaliação gratuita." },
  { name: "Rio Arte Dermatologia e Estética", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@rioarteestetica", whatsapp: "", contactName: "", context: "81k seguidores, protocolos peptídeos." },
  { name: "Bella Estética Rio", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@bella_estetica_rio", whatsapp: "", contactName: "", context: "Desde 2019, avaliação gratuita." },
  { name: "Companhia da Beleza", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@companhiadabeleza.rj", whatsapp: "", contactName: "", context: "RJ." },
  { name: "Clínica Lifecare Bioestética", niche: "estetica", city: "Rio de Janeiro/RJ", instagram: "@clinicalifecare", whatsapp: "", contactName: "", context: "Laranjeiras + Tijuca." },

  // ── Veterinária — BH + Curitiba (Instagram) ──
  { name: "Clínica Vet BH 24h", niche: "vet", city: "Belo Horizonte/MG", instagram: "@clinicavetbelohorizonte", whatsapp: "3135301228", contactName: "", context: "Pronto atendimento 24h." },
  { name: "MedVet BH 24h", niche: "vet", city: "Belo Horizonte/MG", instagram: "@medvetbh", whatsapp: "3134952234", contactName: "", context: "Clínica geral, internação, cirurgia." },
  { name: "Núcleo Veterinário BH", niche: "vet", city: "Belo Horizonte/MG", instagram: "@nucleoveterinariobh", whatsapp: "", contactName: "", context: "BH." },
  { name: "VIDAPET Curitiba", niche: "vet", city: "Curitiba/PR", instagram: "@vidapetcuritiba", whatsapp: "", contactName: "", context: "2 unidades, 24h." },
  { name: "Da Vinci Veterinária 24h", niche: "vet", city: "Curitiba/PR", instagram: "@veterinariadavinci", whatsapp: "", contactName: "", context: "Consultas, cirurgias, banho & tosa 24h." },
];
