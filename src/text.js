import * as THREE from 'three';
import * as maptalks from 'maptalks';
//import {BaseObject} from 'maptalks.three';
import BaseObject from './BaseObject';


const OPTIONS = {
    size: 400,
    height: 50,//字体的厚度
    weight: "normal",
    bevelThickness: 0.2,
    bevelSize: 0.5,
    bevelSegments: 3,
    bevelEnabled: false,
    curveSegments: 12,
    steps: 1
};

class MaptalkText extends BaseObject {
    constructor(coordinate,txt, options, material, layer) {
        options = maptalks.Util.extend({}, OPTIONS, options, { layer, coordinate });
        super();
        this._initOptions(options);

        var textGeo =  new THREE.TextGeometry(txt, options);
        textGeo.computeBoundingBox();
        textGeo.computeVertexNormals();

        var centerOffset = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );
        var geometry = new THREE.BufferGeometry().fromGeometry( textGeo );
        this._createMesh(geometry, material);
        /*
        text1.position.z = v.z;
        text1.position.y = v.y;
        text1.position.x = v.x + centerOffset;
        */
        const { altitude } = options;
        const z = layer.distanceToVector3(altitude, altitude).x;
        const position = layer.coordinateToVector3(coordinate, z);
        position.x += centerOffset;
        this.getObject3d().position.copy(position);
        this.getObject3d().rotation.y = Math.PI * 2;
    }
}

export {MaptalkText};