./js-give-me-a-reason.js "`cat test.js`"|../Reason/refmt_impl.native -parse json -print re -use-stdin true -is-interface-pp false -assume-explicit-arity true


# How to test the structure of various Reason syntax:
# echo "(1, 2)" | ../Reason/refmt_impl.native -parse re -print json -is-interface-pp false -use-stdin true
#
# echo "ee ? ifTrue : ifFalse " | ../Reason/refmt_impl.native -parse re -print json -is-interface-pp false -use-stdin true

