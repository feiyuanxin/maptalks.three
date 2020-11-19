import * as maptalks from 'maptalks';
import * as THREE from 'three';
import BaseObject from './BaseObject';
import { initVertexColors, getExtrudeGeometryParams } from './util/ExtrudeUtil';
import ExtrudePolygon from './ExtrudePolygon';
import MergedMixin from './MergedMixin';
import { getGeoJSONCenter, isGeoJSONPolygon } from './util/GeoJSONUtil';
import { mergeBufferGeometries } from './util/MergeGeometryUtil';
import { getActor } from './worker/MeshActor';
import { addAttribute } from './util/ThreeAdaptUtil';


function updateAttribute(data) {
    //arraybuffer data
    const { position, normal, uv, indices } = data;
    const color = new Float32Array(position.length);
    color.fill(1, 0, position.length);
    const bufferGeomertry = new THREE.BufferGeometry();
    addAttribute(bufferGeomertry, 'color', new THREE.BufferAttribute(color, 3));
    addAttribute(bufferGeomertry, 'normal', new THREE.BufferAttribute(new Float32Array(normal), 3));
    addAttribute(bufferGeomertry, 'position', new THREE.BufferAttribute(new Float32Array(position), 3));
    addAttribute(bufferGeomertry, 'uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    bufferGeomertry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    return bufferGeomertry;
}

const OPTIONS = {
    altitude: 0,
    height: 1,
    topColor: null,
    bottomColor: '#2d2f61',
};

class ExtrudePolygons extends MergedMixin(BaseObject) {
    constructor(polygons, options, material, layer) {
        if (!Array.isArray(polygons)) {
            polygons = [polygons];
        }
        const len = polygons.length;
        if (len === 0) {
            console.error('polygons is empty');
        }
        // const centers = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < len; i++) {
            const polygon = polygons[i];
            const center = (polygon.getCenter ? polygon.getCenter() : getGeoJSONCenter(polygon));
            let x, y;
            if (Array.isArray(center)) {
                x = center[0];
                y = center[1];
            } else if (center instanceof maptalks.Coordinate) {
                x = center.x;
                y = center.y;
            }
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        // Get the center point of the point set
        const center = new maptalks.Coordinate((minX + maxX) / 2, (minY + maxY) / 2);
        options = maptalks.Util.extend({}, OPTIONS, options, { layer, polygons, coordinate: center });
        const { topColor, bottomColor, altitude, asynchronous } = options;
        let bufferGeometry;
        const extrudePolygons = [], faceMap = [], geometriesAttributes = [];
        if (asynchronous) {
            var actor = getActor();
            const SIZE = 0.000001;
            bufferGeometry = new THREE.BoxBufferGeometry(SIZE, SIZE, SIZE * 5);
            actor.pushQueue({
                type: 'Polygon',
                layer,
                key: options.key,
                center,
                data: polygons,
                callback: (e) => {
                    const { faceMap, geometriesAttributes } = e;
                    this._faceMap = faceMap;
                    this._geometriesAttributes = geometriesAttributes;
                    const bufferGeometry = updateAttribute(e);
                    if (topColor && !material.map) {
                        initVertexColors(bufferGeometry, bottomColor, topColor);
                        material.vertexColors = THREE.VertexColors;
                    }
                    this.getObject3d().geometry.dispose();
                    this.getObject3d().geometry = bufferGeometry;
                    this.getObject3d().material.needsUpdate = true;
                    this._geometryCache = bufferGeometry.clone();
                    this._fire('workerload', { target: this });
                }
            });
        } else {
            const geometries = [];
            let faceIndex = 0, psIndex = 0, normalIndex = 0, uvIndex = 0;
            const altCache = {};
            for (let i = 0; i < len; i++) {
                const polygon = polygons[i];
                const height = (isGeoJSONPolygon(polygon) ? polygon.properties : polygon.getProperties() || {}).height || 1;
                const buffGeom = getExtrudeGeometryParams(polygon, height, layer, center, altCache);
                geometries.push(buffGeom);

                // const extrudePolygon = new ExtrudePolygon(polygon, Object.assign({}, options, { height, index: i }), material, layer);
                // extrudePolygons.push(extrudePolygon);

                const { position, normal, uv, indices } = buffGeom;
                const faceLen = indices.length / 3;
                faceMap[i] = [faceIndex + 1, faceIndex + faceLen];
                faceIndex += faceLen;
                const psCount = position.length / 3,
                    //  colorCount = buffGeom.attributes.color.count,
                    normalCount = normal.length / 3, uvCount = uv.length / 2;
                geometriesAttributes[i] = {
                    position: {
                        count: psCount,
                        start: psIndex,
                        end: psIndex + psCount * 3,
                    },
                    normal: {
                        count: normalCount,
                        start: normalIndex,
                        end: normalIndex + normalCount * 3,
                    },
                    // color: {
                    //     count: colorCount,
                    //     start: colorIndex,
                    //     end: colorIndex + colorCount * 3,
                    // },
                    uv: {
                        count: uvCount,
                        start: uvIndex,
                        end: uvIndex + uvCount * 2,
                    },
                    hide: false
                };
                psIndex += psCount * 3;
                normalIndex += normalCount * 3;
                // colorIndex += colorCount * 3;
                uvIndex += uvCount * 2;
            }
            bufferGeometry = mergeBufferGeometries(geometries);
            if (topColor && !material.map) {
                initVertexColors(bufferGeometry, bottomColor, topColor);
                material.vertexColors = THREE.VertexColors;
            }
        }

        super();
        this._initOptions(options);

        this._createMesh(bufferGeometry, material);
        const z = layer.distanceToVector3(altitude, altitude).x;
        const v = layer.coordinateToVector3(center, z);
        this.getObject3d().position.copy(v);

        //Face corresponding to monomer
        this._faceMap = faceMap;
        this._baseObjects = extrudePolygons;
        this._datas = polygons;
        this._geometriesAttributes = geometriesAttributes;
        this.faceIndex = null;
        this._geometryCache = bufferGeometry.clone();
        this.isHide = false;

        this._initBaseObjectsEvent(extrudePolygons);
    }

    // eslint-disable-next-line consistent-return
    getSelectMesh() {
        const index = this._getIndex();
        if (index != null) {
            if (!this._baseObjects[index]) {
                const polygon = this._datas[index];
                const opts = Object.assign({}, this.options, isGeoJSONPolygon(polygon) ? polygon.properties : polygon.getProperties(), { index });
                this._baseObjects[index] = new ExtrudePolygon(polygon, opts, this.getObject3d().material, this.getLayer());
                this._proxyEvent(this._baseObjects[index]);
            }
            return {
                data: this._datas[index],
                baseObject: this._baseObjects[index]
            };
        }
    }

    // eslint-disable-next-line consistent-return
    _getIndex(faceIndex) {
        if (faceIndex == null) {
            faceIndex = this.faceIndex;
        }
        if (faceIndex != null) {
            for (let i = 0, len = this._faceMap.length; i < len; i++) {
                const [start, end] = this._faceMap[i];
                if (start <= faceIndex && faceIndex < end) {
                    return i;
                }
            }
        }
    }
}

export default ExtrudePolygons;
