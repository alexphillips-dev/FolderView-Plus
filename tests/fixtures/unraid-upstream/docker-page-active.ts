export default {
    async shouldApply() {
        return {
            shouldApply: true,
            reason: 'fixture activation',
        };
    },
    template: '<unraid-docker-container-overview></unraid-docker-container-overview>',
};
