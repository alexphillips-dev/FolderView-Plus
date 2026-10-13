import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('PHP icon staging assembles 16 MiB once and rejects unauthorized, reordered, mismatched or oversized parts', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-parts-'));
    try {
        const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server').replaceAll('\\', '/');
        const rows = JSON.parse(execFileSync('php', ['-d', 'memory_limit=256M', '-r', `
            const FVPLUS_CUSTOM_ICON_MAX_BYTES=16777216; const FVPLUS_CUSTOM_ICON_EXTENSIONS=['png'];
            require ${JSON.stringify(server + '/lib.custom-icon-validation.php')};
            function getConfiguredRequestToken(){return 'fixture-token';}
            function normalizeBool($v,$default=false){return $v==='1'||$v===true;}
            function enforceCustomIconUploadRateLimit(){$GLOBALS['rateCalls']=($GLOBALS['rateCalls']??0)+1;}
            function part($id,$index,$size=16777216){
                $length=min(FVPLUS_ICON_CHUNK_BYTES,$size-$index*FVPLUS_ICON_CHUNK_BYTES);
                return ['icon_upload_id'=>$id,'icon_chunk_index'=>(string)$index,'icon_chunk_count'=>(string)ceil($size/FVPLUS_ICON_CHUNK_BYTES),
                    'icon_total_bytes'=>(string)$size,'icon_inline_name'=>'fixture.png','replace'=>'0','dedupe'=>'1',
                    'icon_inline_data'=>strtr(base64_encode(str_repeat("\\xff",max(1,$length))),'+/','-_')];
            }
            $rows=[]; $_SERVER['REMOTE_ADDR']='fixture-owner'; $_POST=part(str_repeat('a',32),0);
            try{stageCustomIconUploadChunk();}catch(Throwable $e){$rows['guard']=$e->getMessage();}
            $GLOBALS['fvplusMutationGuardComplete']=true;
            $first=stageCustomIconUploadChunk(); $rows['first']=$first['nextChunk'];
            foreach(['reorder','owner','metadata','oversize','path','length'] as $case){
                $_POST=part(str_repeat('a',32),1); $_SERVER['REMOTE_ADDR']='fixture-owner';
                if($case==='reorder')$_POST['icon_chunk_index']='2';
                if($case==='owner')$_SERVER['REMOTE_ADDR']='other-owner';
                if($case==='metadata')$_POST['replace']='1';
                if($case==='oversize')$_POST['icon_total_bytes']='16777217';
                if($case==='path')$_POST['icon_upload_id']='../outside';
                if($case==='length')$_POST['icon_inline_data']='Zm9v';
                try{stageCustomIconUploadChunk();$rows[$case]=false;}catch(Throwable $e){$rows[$case]=true;}
            }
            $_SERVER['REMOTE_ADDR']='fixture-owner';
            for($index=1;$index<33;$index++){$_POST=part(str_repeat('a',32),$index);$last=stageCustomIconUploadChunk();}
            $rows['complete']=$last['complete'];
            $rows['bytes']=(int)filesize($last['tmpPath']);
            $rows['match']=hash_file('sha256',$last['tmpPath'])===hash('sha256',str_repeat("\\xff",16777216));
            unlink($last['cleanupPath']); $rows['rates']=$GLOBALS['rateCalls'];
            for($index=0;$index<4;$index++){$_POST=part(str_repeat(dechex($index+1),32),0);stageCustomIconUploadChunk();}
            $_POST=part(str_repeat('5',32),0);
            try{stageCustomIconUploadChunk();$rows['bounded']=false;}catch(Throwable $e){$rows['bounded']=true;}
            foreach(glob(customIconUploadStageDirectory().'/fv-chunk-*') as $file)touch($file,time()-301);
            clearstatcache(); stageCustomIconUploadChunk();
            $rows['expired']=count(glob(customIconUploadStageDirectory().'/fv-chunk-*.part'))===1;
            echo json_encode($rows);
        `], { encoding: 'utf8', env: { ...process.env, FVPLUS_TEST_ICON_STAGE_DIR: directory } }));
        assert.match(rows.guard, /Blocked by request guard/);
        assert.equal(rows.first, 1);
        for (const key of ['reorder', 'owner', 'metadata', 'oversize', 'path', 'length', 'complete', 'match', 'bounded', 'expired']) assert.equal(rows[key], true, key);
        assert.equal(rows.bytes, 16777216);
        assert.equal(rows.rates, 1, 'only the first part counts as an icon upload');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
