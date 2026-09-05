module.exports = {
  Platform: {
    OS: 'ios',
    select: (obj) => (obj && (obj.ios !== undefined ? obj.ios : obj.default)),
  },
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    absoluteFillObject: {},
  },
};
