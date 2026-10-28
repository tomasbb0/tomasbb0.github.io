// Sleep Diary Questions - EXACTLY matching original paper form
const QUESTIONS = [
    // ==================== MANHÃ ====================
    {
        id: 'acordou',
        section: 'MANHÃ',
        title: '1. A que horas acordou esta manhã?',
        type: 'time-picker'
    },
    {
        id: 'levantou',
        section: 'MANHÃ',
        title: '2. A que horas se levantou da cama esta manhã?',
        type: 'time-picker'
    },
    {
        id: 'como_sente_manha',
        section: 'MANHÃ',
        title: '3. Como se sente esta manhã?',
        type: 'choice',
        options: ['Muito mal', 'Mal', 'Razoavelmente', 'Bem', 'Muito bem']
    },
    
    // ==================== FATORES DIÁRIOS ====================
    {
        id: 'sestas',
        section: 'FATORES DIÁRIOS',
        title: '4. Sestas durante o dia',
        type: 'choice',
        options: ['Não', 'Sim']
    },
    {
        id: 'sestas_duracao',
        section: 'FATORES DIÁRIOS',
        title: 'Duração da sesta:',
        type: 'duration-picker',
        condition: { field: 'sestas', value: 'Sim' }
    },
    {
        id: 'cafeina',
        section: 'FATORES DIÁRIOS',
        title: '5. Ingestão de Cafeína (chás, cafés, etc)',
        subtitle: 'Tipo e quantidade',
        type: 'choice',
        options: ['Não bebi', '1 café/chá', '2 cafés/chás', '3 cafés/chás', '4+ cafés/chás']
    },
    {
        id: 'cafeina_ultima_hora',
        section: 'FATORES DIÁRIOS',
        title: 'Última hora de Consumo',
        type: 'time-picker',
        condition: { field: 'cafeina', value: (v) => v && v !== 'Não bebi' }
    },
    {
        id: 'atividade_fisica',
        section: 'FATORES DIÁRIOS',
        title: '6. Atividade Física',
        subtitle: 'Tipo e duração',
        type: 'choice',
        options: ['Nenhuma', 'Caminhada', 'Corrida', 'Ginásio', 'Natação', 'Bicicleta', 'Outro']
    },
    {
        id: 'atividade_fisica_duracao',
        section: 'FATORES DIÁRIOS',
        title: 'Duração:',
        type: 'duration-picker',
        condition: { field: 'atividade_fisica', value: (v) => v && v !== 'Nenhuma' }
    },
    
    // ==================== NOITE ====================
    {
        id: 'deitou',
        section: 'NOITE',
        title: '7. A que horas se deitou na noite passada?',
        type: 'time-picker'
    },
    {
        id: 'tempo_adormecer',
        section: 'NOITE',
        title: '8. Quanto tempo demorou a adormecer?',
        subtitle: '(em minutos)',
        type: 'duration-picker'
    },
    {
        id: 'vezes_acordou',
        section: 'NOITE',
        title: '9. Quantas vezes acordou durante a noite?',
        type: 'choice',
        options: ['0', '1', '2', '3', '4', '5+']
    },
    {
        id: 'despertares_oque',
        section: 'NOITE',
        title: '10. O que fez durante os despertares noturnos?',
        type: 'text',
        condition: { field: 'vezes_acordou', value: (v) => v && v !== '0' }
    },
    {
        id: 'tempo_acordado_noite',
        section: 'NOITE',
        title: '11. Quanto tempo esteve acordado durante a noite?',
        subtitle: '(total em minutos)',
        type: 'duration-picker',
        condition: { field: 'vezes_acordou', value: (v) => v && v !== '0' }
    },
    {
        id: 'sono_total',
        section: 'NOITE',
        title: '12. Quanto tempo dormiu ao todo?',
        subtitle: '(em horas/minutos)',
        type: 'sleep-duration-picker'
    },
    {
        id: 'comprimidos',
        section: 'NOITE',
        title: '13. Que comprimidos tomou para dormir na noite passada? Quantos?',
        type: 'text'
    },
    {
        id: 'alcool',
        section: 'NOITE',
        title: '14. Que quantidade de bebidas alcoólicas ingeriu na noite passada?',
        type: 'choice',
        options: ['Não bebi', '1 bebida', '2 bebidas', '3 bebidas', '4+ bebidas']
    },
    {
        id: 'qualidade_noite',
        section: 'NOITE',
        title: '15. Como acha que passou a noite?',
        type: 'choice',
        options: ['Muito mal', 'Mal', 'Razoavelmente', 'Bem', 'Muito bem']
    }
];
