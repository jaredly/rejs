exports.noPos = {pos_fname: 'hah', pos_lnum: 0, pos_cnum: 0, pos_bol: 0}
exports.noLoc = {loc_start: exports.noPos, loc_end: exports.noPos, loc_ghost: false}
exports.patNull = ['Ppat_construct', {txt: ['Lident', '()'], loc: exports.noLoc}, null]
exports.expNull = ['Pexp_construct', {txt: ['Lident', '()'], loc: exports.noLoc}, null]
