import * as maptalks from 'maptalks';
import * as THREE from 'three';
//import { BaseObject } from 'maptalks.three'
import BaseObject from './BaseObject';

const OPTIONS = {
    altitude: 0,
    height: 0
};

const vector = new THREE.Vector3();

class newPoint extends BaseObject {
    constructor(coordinate, options, material, layer) {
        options = maptalks.Util.extend({}, OPTIONS, options, { layer, coordinate });
        super();
        let { width,height,altitude } = options;
        this._initOptions(options);

        var geometry = new THREE.PlaneBufferGeometry(width, height);
        this._createMesh(geometry, material);
        const z = layer.distanceToVector3(altitude, altitude).x;
        const position = layer.coordinateToVector3(coordinate, z);
        this.getObject3d().position.copy(position);

    }

}

export {newPoint};
