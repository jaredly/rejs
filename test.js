let myObject = {
  x: 100,
  y: 200
};
let myFunc = function(a, b) {
  if (true) {
    var x = 100;
    var a = 100,
        b = 200;
    myObject.y = 200;
    let tmp = 100;
    a + b + someHelperFunction(x, tmp, myObject.x);
  } else {
    throw new Error('text', secondArg);
    return 0;
   }
 }

let resolveDirection = function(node, parentDirection) {
  var direction;
  if (node.style.direction) {
    direction = node.style.direction;
  } else {
    direction = CSS_DIRECTION_INHERIT;
  }

  if (direction === CSS_DIRECTION_INHERIT) {
    direction = (parentDirection === undefined ? CSS_DIRECTION_LTR : parentDirection);
  }

  return direction;
}

/**
 * Good example of where we really need early return transform.
 *
 * let getFlexDirection node => {
 *   if node.style.flexDirection {
 *     node.style.flexDirection
 *   };
 *   CSS_FLEX_DIRECTION_COLUMN
 * };
 */

function getFlexDirection(node) {
  if (node.style.flexDirection) {
    return node.style.flexDirection;
  }
  return CSS_FLEX_DIRECTION_COLUMN;
}

// Max main dimension of all the lines.
var/*float*/ maxLineMainDim = /*float*/0;

while (endOfLineIndex < childCount) {
  
  // Number of items on the currently line. May be different than the difference
  // between start and end indicates because we skip over absolute-positioned items.
  var/*int*/ itemsOnLine = 0;

  // sizeConsumedOnCurrentLine is accumulation of the dimensions and margin
  // of all the children on the current line. This will be used in order to
  // either set the dimensions of the node if none already exist or to compute
  // the remaining space left for the flexible children.
  var/*float*/ sizeConsumedOnCurrentLine = /*float*/0;

  var/*float*/ totalFlexGrowFactors = /*float*/0;
  var/*float*/ totalFlexShrinkScaledFactors = /*float*/0;

  var/*int*/ curIndex = startOfLineIndex;

  // Maintain a linked list of the child nodes that can shrink and/or grow.
  var/*css_node_t**/ firstRelativeChild = undefined;
  var/*css_node_t**/ currentRelativeChild = undefined;

  // Add items to the current line until it's full or we run out of items.
  var shouldContinue = true;
  while (curIndex < childCount && shouldContinue) {
    child = node.children[curIndex];
    child.lineIndex = lineCount;

    if (getPositionType(child) !== CSS_POSITION_ABSOLUTE) {
      var/*float*/ outerFlexBasis = child.layout.flexBasis + getMarginAxis(child, mainAxis);
      
      // If this is a multi-line flow and this item pushes us over the available size, we've
      // hit the end of the current line. Break out of the loop and lay out the current line.
      if (sizeConsumedOnCurrentLine + outerFlexBasis > availableInnerMainDim && isNodeFlexWrap && itemsOnLine > 0) {
        shouldContinue = false;
      } else {
        sizeConsumedOnCurrentLine += outerFlexBasis;
        itemsOnLine++;

        if (isFlex(child)) {
          totalFlexGrowFactors += getFlexGrowFactor(child);
          
          // Unlike the grow factor, the shrink factor is scaled relative to the child
          // dimension.
          totalFlexShrinkScaledFactors += getFlexShrinkFactor(child) * child.layout.flexBasis;
        }

        // Store a private linked list of children that need to be layed out.
        if (firstRelativeChild === undefined) {
          firstRelativeChild = child;
        }
        if (currentRelativeChild !== undefined) {
          currentRelativeChild.nextChild = child;
        }
        currentRelativeChild = child;
        child.nextChild = undefined;
      }
      curIndex++;
      endOfLineIndex++;
    } else {
      curIndex++;
      endOfLineIndex++;
    }
  }
}

